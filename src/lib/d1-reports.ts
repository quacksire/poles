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
const reportColumns = [
  "id",
  "stop_id",
  "contributor",
  "visited_on",
  "notes",
  "created_at",
  ...answerColumns,
];
const snapshotColumns = [
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
const latestSnapshotColumns = [
  "stop_id",
  "stop_name",
  "feed_stop_id",
  "lat",
  "lng",
  "contributor",
  "visited_on",
  "notes",
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
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return null;
}

function answersToDatabaseValues(answers: SurveyAnswers) {
  return answerColumns.map((column) => toDatabaseBoolean(answers[column] ?? null));
}

function rowToAnswers(row: Record<string, unknown>) {
  return mergeSurveyAnswers(
    Object.fromEntries(
      answerColumns.map((column) => [column, fromDatabaseBoolean(row[column])]),
    ),
  );
}

function rowToReport(row: Record<string, unknown>): StopReport {
  return {
    id: String(row.id ?? ""),
    stopId: String(row.stop_id ?? ""),
    contributor: String(row.contributor ?? ""),
    visitedOn: String(row.visited_on ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
    answers: rowToAnswers(row),
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
  const statement = db.prepare(
    `SELECT ${reportColumns.join(", ")} FROM stop_reports ORDER BY created_at DESC`,
  );
  const result = await statement.all<Record<string, unknown>>();

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
        `INSERT INTO stop_reports (${reportColumns.join(", ")}) VALUES (${reportColumns
          .map(() => "?")
          .join(", ")})`,
      )
      .bind(...reportValues),
    db
      .prepare(
        `INSERT INTO stop_snapshots (${snapshotColumns.join(", ")})
         VALUES (${snapshotColumns.map(() => "?").join(", ")})
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
  const db = await getDatabase();
  const snapshotResult = await db
    .prepare(
      `SELECT ${latestSnapshotColumns.join(", ")} FROM stop_snapshots ORDER BY stop_name ASC`,
    )
    .all<Record<string, unknown>>();
  const snapshotByStopId = new Map(
    (snapshotResult.results ?? []).map((row) => [String(row.stop_id), row]),
  );

  const header = [
    "stop_name",
    "stop_id",
    "sign_pole",
    "sign_shelter",
    "sign_stand",
    "sign_none",
    "seating",
    "shelter",
    "shade",
    "environment_bus_bay",
    "environment_street",
    "environment_parking_lot",
    "lat",
    "lng",
    "contributor",
    "visited_on",
    "notes",
    "updated_at",
  ];

  const rows = stops.map((stop) => {
    const snapshot = snapshotByStopId.get(stop.id);
    const answers = snapshot ? rowToAnswers(snapshot) : mergeSurveyAnswers();

    return [
      stop.name,
      stop.stopId || stop.id,
      csvValue(answers.sign_pole),
      csvValue(answers.sign_shelter),
      csvValue(answers.sign_stand),
      csvValue(answers.sign_none),
      csvValue(answers.seating),
      csvValue(answers.shelter),
      csvValue(answers.shade),
      csvValue(answers.environment_bus_bay),
      csvValue(answers.environment_street),
      csvValue(answers.environment_parking_lot),
      csvValue(stop.coordinates[1]),
      csvValue(stop.coordinates[0]),
      csvValue(String(snapshot?.contributor ?? "")),
      csvValue(String(snapshot?.visited_on ?? "")),
      csvValue(String(snapshot?.notes ?? "")),
      csvValue(String(snapshot?.updated_at ?? "")),
    ]
      .map((value) => escapeCsvCell(String(value)))
      .join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
