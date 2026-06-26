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
const snapshotWriteColumns = [
  "stop_id",
  "stop_name",
  "feed_stop_id",
  "lat",
  "lng",
  "contributor",
  "visited_on",
  "notes",
  "created_at",
  "updated_at",
  ...answerColumns,
];

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

function fromDatabaseBoolean(value: unknown): boolean | null {
  if (value === 1 || value === "1" || value === true) return true;
  if (value === 0 || value === "0" || value === false) return false;
  return null;
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

function rowToReport(row: Record<string, unknown>): StopReport {
  return {
    id: String(row.id ?? ""),
    stopId: String(row.stop_id ?? ""),
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

export async function listReports() {
  const db = await getDatabase();
  const result = await db.prepare(`SELECT * FROM stop_reports ORDER BY created_at DESC`).all<Record<string, unknown>>();

  return (result.results ?? []).map(rowToReport);
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

  const db = await getDatabase();
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
    stop.id,
    stop.name,
    stop.stopId,
    stop.coordinates[1],
    stop.coordinates[0],
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
           stop_name = excluded.stop_name,
           feed_stop_id = excluded.feed_stop_id,
           lat = excluded.lat,
           lng = excluded.lng,
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
    "stop_id",
    ...answerColumns,
    "lat",
    "lng",
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
      stop.stopId || stop.id,
      ...answerColumns.map((column) => csvValue(answers[column])),
      csvValue(stop.coordinates[1]),
      csvValue(stop.coordinates[0]),
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
