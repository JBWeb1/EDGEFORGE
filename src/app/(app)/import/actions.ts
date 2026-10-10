"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bumpDataVersion } from "@/lib/data/sync";
import { parseTradeCsv, type ParseResult } from "@/lib/import/csv";
import { requireUser } from "@/lib/session";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportState =
  | { stage: "idle" }
  | { stage: "error"; message: string }
  | {
      stage: "preview";
      fileName: string;
      accountId: string;
      csv: string;
      fileErrors: string[];
      mapping: ParseResult["mapping"];
      valid: number;
      duplicatesInDb: number;
      invalid: { line: number; errors: string[] }[];
      sample: { line: number; symbol: string; direction: string; entryAt: string; exitAt: string | null; duplicate: boolean }[];
    }
  | { stage: "done"; imported: number; duplicates: number; invalid: number };

async function analyse(userId: string, accountId: string, csv: string) {
  const account = await prisma.tradingAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return { error: "Choose one of your accounts." } as const;
  const parsed = parseTradeCsv(csv);
  const valid = parsed.rows.flatMap((r) => (r.ok ? [r] : []));
  const existing = valid.length
    ? await prisma.trade.findMany({
        where: { accountId, fingerprint: { in: valid.map((r) => r.trade.fingerprint) } },
        select: { fingerprint: true },
      })
    : [];
  const known = new Set(existing.map((e) => e.fingerprint));
  return { account, parsed, valid, known } as const;
}

export async function importCsv(prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const intent = formData.get("intent");
  const accountId = String(formData.get("accountId") ?? "");

  let csv: string;
  let fileName: string;
  if (intent === "commit" && prev.stage === "preview") {
    // The preview state round-trips through the browser, so it is re-checked
    // and re-parsed exactly like a fresh upload.
    csv = prev.csv;
    fileName = prev.fileName.slice(0, 200);
    if (csv.length > MAX_FILE_BYTES) return { stage: "error", message: "The file is larger than 2 MB." };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { stage: "error", message: "Choose a CSV file to upload." };
    if (file.size > MAX_FILE_BYTES) return { stage: "error", message: "The file is larger than 2 MB. Split it into smaller files." };
    csv = await file.text();
    fileName = file.name.slice(0, 200);
  }

  const result = await analyse(user.id, accountId, csv);
  if ("error" in result) return { stage: "error", message: result.error! };
  const { parsed, valid, known } = result;
  const invalidRows = parsed.rows.flatMap((r) => (r.ok ? [] : [{ line: r.line, errors: r.errors }]));

  if (intent !== "commit" || parsed.fileErrors.length) {
    return {
      stage: "preview",
      fileName,
      accountId,
      csv,
      fileErrors: parsed.fileErrors,
      mapping: parsed.mapping,
      valid: valid.length - known.size,
      duplicatesInDb: known.size,
      invalid: invalidRows,
      sample: valid.slice(0, 10).map((r) => ({
        line: r.line,
        symbol: r.trade.symbol,
        direction: r.trade.direction,
        entryAt: r.trade.entryAt.toISOString(),
        exitAt: r.trade.exitAt?.toISOString() ?? null,
        duplicate: known.has(r.trade.fingerprint),
      })),
    };
  }

  const fresh = valid.filter((r) => !known.has(r.trade.fingerprint));
  const imported = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userId: user.id,
        accountId,
        fileName,
        totalRows: parsed.rows.length,
        importedCount: 0,
        duplicateCount: 0,
        invalidCount: invalidRows.length,
      },
    });
    // skipDuplicates covers a concurrent import of the same file.
    const { count } = await tx.trade.createMany({
      data: fresh.map(({ trade }) => ({ ...trade, userId: user.id, accountId, importBatchId: batch.id })),
      skipDuplicates: true,
    });
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { importedCount: count, duplicateCount: valid.length - count },
    });
    if (count) await bumpDataVersion(user.id, tx);
    return count;
  });

  revalidatePath("/", "layout");
  return { stage: "done", imported, duplicates: valid.length - imported, invalid: invalidRows.length };
}
