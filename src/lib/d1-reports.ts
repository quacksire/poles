import { gtfsFeed } from "@/lib/gtfs";
import { stopById, stops } from "@/lib/stops";
import {
  mergeSurveyAnswers,
  surveyAttributeDefinitions,
  type StopReport,
  type SurveyAnswers,
} from "@/lib/survey";

export type SaveReportInput = {
  stopId: string;
  contributor?: string;
  visitedOn?: string;
  notes?: string;
  answers?: Partial<Record<string, unknown>>;
};

const answerColumns = surveyAttributeDefinitions.map((attribute) => attribute.id);
const reportWriteColumns = [
  "id",
  "stop_id",
  "contributor",
  "visited_on",
  "notes",
  "created_at",
  ...answerColumns,
];
const snapshotMetadataColumns = [
  "stop_id",
  "stop_name",
  "feed_stop_id",
  "stop_code",
  "stop_url",
  "stop_domain",
  "parent_station_id",
  "parent_station_name",
  "platform_code",
  "zone_id",
  "stop_timezone",
  "location_type",
  "wheelchair_boarding",
  "route_ids",
  "route_names",
  "agency_names",
  "route_count",
  "is_served",
  "feed_id",
  "feed_version",
  "feed_fingerprint",
  "lat",
  "lng",
];
const snapshotWriteColumns = [
  ...snapshotMetadataColumns,
  "contributor",
  "visited_on",
  "notes",
  "created_at",
  "updated_at",
  ...answerColumns,
];

const snapshotMetadataAssignments = snapshotMetadataColumns
  .filter((column) => column !== "stop_id")
  .map((column) => `${column} = excluded.${column}`)
  .join(", ");

async function getDatabase() {
  const { env } = await import("cloudflare:workers");

  if (!("DB" in env) || !env.DB) {
    throw new Error(
      "Missing Cloudflare D1 binding `DB`. Add the database binding in wrangler.jsonc before using reports.",
    );
  }

  return env.DB;
}

function createReportId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDatabaseBoolean(value: boolean | null) {
  if (value === null) return null;
  return value ? 1 : 0;
}

function toDatabaseText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function answersToDatabaseValues(answers: SurveyAnswers) {
  return surveyAttributeDefinitions.map((attribute) => {
    const value = answers[attribute.id];

    if (attribute.type === "boolean") {
      return toDatabaseBoolean(
        value === true ? true : value === false ? false : null,
      );
    }

    return toDatabaseText(value);
  });
}

function rowToReport(row: Record<string, unknown>): StopReport | null {
  const stopId = String(row.stop_id ?? "");
  if (!stopById.has(stopId)) return null;

  return {
    id: String(row.id ?? ""),
    stopId,
    contributor: String(row.contributor ?? ""),
    visitedOn: String(row.visited_on ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
    answers: mergeSurveyAnswers(row),
  };
}

function escapeCsvCell(value: string) {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function csvValue(value: boolean | null | number | string) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function joinRouteLabels(stopId: string) {
  return stopById.get(stopId)?.servingRoutes.map((route) => route.label).join("; ") ?? "";
}

function joinRouteIds(stopId: string) {
  return stopById.get(stopId)?.servingRoutes.map((route) => route.id).join("; ") ?? "";
}

function joinAgencyNames(stopId: string) {
  return stopById.get(stopId)?.servingAgencies.join("; ") ?? "";
}

function snapshotMetadataValues(stopId: string) {
  const stop = stopById.get(stopId);
  if (!stop) {
    throw new Error(`Unknown stop: ${stopId}`);
  }

  return [
    stop.id,
    stop.name,
    stop.gtfsStopId,
    stop.code,
    stop.stopUrl ?? "",
    stop.stopDomain ?? "",
    stop.parentStationId ?? "",
    stop.parentName ?? "",
    stop.platformCode ?? "",
    stop.zoneId ?? "",
    stop.timezone ?? "",
    stop.locationType,
    stop.wheelchairBoarding,
    joinRouteIds(stop.id),
    joinRouteLabels(stop.id),
    joinAgencyNames(stop.id),
    stop.routeCount,
    stop.isServed ? 1 : 0,
    gtfsFeed.feedId,
    gtfsFeed.feedVersion,
    gtfsFeed.fingerprint,
    stop.coordinates[1],
    stop.coordinates[0],
  ];
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function ensureGtfsSync() {
  const db = await getDatabase();
  const currentSync = await db
    .prepare(`SELECT dataset_fingerprint FROM gtfs_sync_state WHERE id = ?`)
    .bind("active")
    .first<{ dataset_fingerprint?: string }>();

  if (currentSync?.dataset_fingerprint === gtfsFeed.fingerprint) {
    return db;
  }

  const syncedAt = new Date().toISOString();
  const blankAnswers = createEmptyAnswerValues();
  const snapshotInsertStatement = `
    INSERT INTO stop_snapshots (${snapshotWriteColumns.join(", ")})
    VALUES (${snapshotWriteColumns.map(() => "?").join(", ")})
    ON CONFLICT(stop_id) DO UPDATE SET
      ${snapshotMetadataAssignments}
  `;

  for (const stopChunk of chunk(stops, 75)) {
    await db.batch(
      stopChunk.map((stop) =>
        db
          .prepare(snapshotInsertStatement)
          .bind(
            ...snapshotMetadataValues(stop.id),
            "",
            "",
            "",
            syncedAt,
            syncedAt,
            ...blankAnswers,
          ),
      ),
    );
  }

  await db.batch([
    db
      .prepare(
        `DELETE FROM stop_snapshots WHERE feed_fingerprint != ?`,
      )
      .bind(gtfsFeed.fingerprint),
    db
      .prepare(
        `INSERT INTO gtfs_sync_state (id, dataset_fingerprint, feed_id, feed_version, stop_count, synced_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           dataset_fingerprint = excluded.dataset_fingerprint,
           feed_id = excluded.feed_id,
           feed_version = excluded.feed_version,
           stop_count = excluded.stop_count,
           synced_at = excluded.synced_at`,
      )
      .bind(
        "active",
        gtfsFeed.fingerprint,
        gtfsFeed.feedId,
        gtfsFeed.feedVersion,
        stops.length,
        syncedAt,
      ),
  ]);

  return db;
}

function createEmptyAnswerValues() {
  return answerColumns.map(() => null);
}

export async function listReports() {
  const db = await ensureGtfsSync();
  const result = await db
    .prepare(`SELECT * FROM stop_reports ORDER BY created_at DESC`)
    .all<Record<string, unknown>>();

  return (result.results ?? [])
    .map(rowToReport)
    .filter((report): report is StopReport => Boolean(report));
}

export async function saveReport(input: SaveReportInput) {
  if (!input || typeof input !== "object") {
    throw new Error("Missing report payload.");
  }
  if (typeof input.stopId !== "string" || !input.stopId.trim()) {
    throw new Error("Missing stopId.");
  }

  const stop = stopById.get(input.stopId);
  if (!stop) {
    throw new Error(`Unknown stop: ${input.stopId}`);
  }

  const answers = mergeSurveyAnswers(input.answers);
  const createdAt = new Date().toISOString();
  const report: StopReport = {
    id: createReportId(),
    stopId: stop.id,
    contributor: input.contributor?.trim() ?? "",
    visitedOn: input.visitedOn?.trim() || createdAt.slice(0, 10),
    notes: input.notes?.trim() ?? "",
    answers,
    createdAt,
  };

  const db = await ensureGtfsSync();
  const reportValues = [
    report.id,
    report.stopId,
    report.contributor,
    report.visitedOn,
    report.notes,
    report.createdAt,
    ...answersToDatabaseValues(report.answers),
  ];
  const snapshotValues = [
    ...snapshotMetadataValues(stop.id),
    report.contributor,
    report.visitedOn,
    report.notes,
    report.createdAt,
    report.createdAt,
    ...answersToDatabaseValues(report.answers),
  ];

  await db.batch([
    db
      .prepare(
        `INSERT INTO stop_reports (${reportWriteColumns.join(", ")}) VALUES (${reportWriteColumns
          .map(() => "?")
          .join(", ")})`,
      )
      .bind(...reportValues),
    db
      .prepare(
        `INSERT INTO stop_snapshots (${snapshotWriteColumns.join(", ")})
         VALUES (${snapshotWriteColumns.map(() => "?").join(", ")})
         ON CONFLICT(stop_id) DO UPDATE SET
           ${snapshotMetadataAssignments},
           contributor = excluded.contributor,
           visited_on = excluded.visited_on,
           notes = excluded.notes,
           updated_at = excluded.updated_at,
           ${answerColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
      )
      .bind(...snapshotValues),
  ]);

  return report;
}

export async function exportReportsCsv() {
  const reports = await listReports();
  const latestReportByStopId = new Map<string, StopReport>();

  for (const report of reports) {
    if (!latestReportByStopId.has(report.stopId)) {
      latestReportByStopId.set(report.stopId, report);
    }
  }

  const header = [
    "stop_name",
    "gtfs_stop_id",
    "stop_code",
    "agency_names",
    "route_count",
    "route_names",
    "is_served",
    "wheelchair_boarding",
    "stop_url",
    "lat",
    "lng",
    ...answerColumns,
    "contributor",
    "visited_on",
    "notes",
    "updated_at",
  ];

  const rows = stops.map((stop) => {
    const report = latestReportByStopId.get(stop.id);
    const answers = report?.answers ?? mergeSurveyAnswers();

    return [
      stop.name,
      stop.gtfsStopId,
      stop.code,
      stop.servingAgencies.join("; "),
      csvValue(stop.routeCount),
      stop.servingRoutes.map((route) => route.label).join("; "),
      csvValue(stop.isServed),
      csvValue(stop.wheelchairBoarding ?? ""),
      csvValue(stop.stopUrl ?? ""),
      csvValue(stop.coordinates[1]),
      csvValue(stop.coordinates[0]),
      ...answerColumns.map((column) => csvValue(answers[column])),
      csvValue(String(report?.contributor ?? "")),
      csvValue(String(report?.visitedOn ?? "")),
      csvValue(String(report?.notes ?? "")),
      csvValue(String(report?.createdAt ?? "")),
    ]
      .map((value) => escapeCsvCell(String(value)))
      .join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
