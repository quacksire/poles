import type { APIRoute } from "astro";

import { exportReportsCsv, listReports, saveReport } from "@/lib/d1-reports";
import { normalizeStoredReport } from "@/lib/survey";

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export const GET: APIRoute = async ({ url }) => {
  try {
    if (url.searchParams.get("format") === "csv") {
      const csv = await exportReportsCsv();
      const stamp = new Date().toISOString().slice(0, 10);

      return new Response(csv, {
        headers: {
          "cache-control": "no-store",
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="poles-stop-surveys-${stamp}.csv"`,
        },
      });
    }

    const reports = await listReports();
    return Response.json(
      { reports },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load stop reports.";
    return jsonError(message);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const savedReport = await saveReport(payload);
    const normalizedReport = normalizeStoredReport(savedReport);

    if (!normalizedReport) {
      return jsonError("Saved report could not be normalized.", 500);
    }

    return Response.json(
      { report: normalizedReport },
      {
        status: 201,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save field visit.";
    const status =
      message.startsWith("Missing")
      || message.startsWith("Unknown stop")
      || error instanceof SyntaxError
        ? 400
        : 500;
    return jsonError(message, status);
  }
};
