import { templateCsv } from "@/lib/import/csv";

export function GET() {
  return new Response(templateCsv() + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="edgeforge-import-template.csv"',
    },
  });
}
