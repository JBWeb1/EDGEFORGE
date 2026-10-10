import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const positiveDecimal = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .regex(/^\d+(\.\d+)?$/, `${label} must be a positive number using "." for decimals.`)
    .refine((v) => Number(v) > 0, `${label} must be greater than zero.`);

const optionalPositiveDecimal = (label: string) =>
  z.preprocess(blankToNull, positiveDecimal(label).nullable());

const isoDate = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} is not a valid date.`)
    .transform((v) => new Date(v));

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable());

export const EMOTIONS = ["CALM", "CONFIDENT", "FOMO", "FEARFUL", "GREEDY", "FRUSTRATED", "REVENGE", "BORED"] as const;

export const tradeSchema = z
  .object({
    accountId: z.string().min(1, "Choose an account."),
    symbol: z.string().trim().min(1, "Symbol is required.").max(32).transform((s) => s.toUpperCase()),
    direction: z.enum(["LONG", "SHORT"], { error: "Choose long or short." }),
    quantity: positiveDecimal("Quantity"),
    multiplier: z.preprocess((v) => blankToNull(v) ?? "1", positiveDecimal("Multiplier")),
    entryPrice: positiveDecimal("Entry price"),
    entryAt: isoDate("Entry time"),
    exitPrice: optionalPositiveDecimal("Exit price"),
    exitAt: z.preprocess(blankToNull, isoDate("Exit time").nullable()),
    stopLoss: optionalPositiveDecimal("Stop loss"),
    takeProfit: optionalPositiveDecimal("Take profit"),
    fees: z.preprocess(
      (v) => blankToNull(v) ?? "0",
      z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Fees must be zero or a positive amount with up to 2 decimals."),
    ),
    setup: optionalText(80),
    strategy: optionalText(80),
    emotion: z.preprocess(blankToNull, z.enum(EMOTIONS).nullable()),
    followedRules: z.preprocess(
      (v) => (v === "yes" ? true : v === "no" ? false : null),
      z.boolean().nullable(),
    ),
    confidence: z.preprocess(
      (v) => (blankToNull(v) === null ? null : Number(v)),
      z.number().int().min(1).max(5).nullable(),
    ),
    notes: optionalText(5000),
    screenshotUrl: z.preprocess(
      blankToNull,
      z.url({ protocol: /^https$/, error: "Screenshot link must be an https:// URL." }).max(2000).nullable(),
    ),
  })
  .superRefine((t, ctx) => {
    if ((t.exitPrice === null) !== (t.exitAt === null)) {
      ctx.addIssue({
        code: "custom",
        path: [t.exitPrice === null ? "exitPrice" : "exitAt"],
        message: "Enter both exit price and exit time to close the trade, or leave both empty while it's open.",
      });
    }
    if (t.exitAt && t.exitAt < t.entryAt) {
      ctx.addIssue({ code: "custom", path: ["exitAt"], message: "Exit time is before entry time." });
    }
    const entry = Number(t.entryPrice);
    if (t.stopLoss !== null) {
      const stop = Number(t.stopLoss);
      const wrongSide = t.direction === "LONG" ? stop >= entry : stop <= entry;
      if (wrongSide) {
        ctx.addIssue({
          code: "custom",
          path: ["stopLoss"],
          message: `For a ${t.direction.toLowerCase()} trade the stop loss must be ${t.direction === "LONG" ? "below" : "above"} the entry price.`,
        });
      }
    }
  });

export type TradeFormInput = z.infer<typeof tradeSchema>;

const optionalMoney = (label: string) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a positive amount with up to 2 decimals.`)
      .refine((v) => Number(v) > 0, `${label} must be greater than zero.`)
      .nullable(),
  );

export const CURRENCIES = ["USD", "ZAR", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF", "USDT"] as const;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  broker: optionalText(60),
  currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
  startingBalance: z.preprocess(
    (v) => blankToNull(v) ?? "0",
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Starting balance must be zero or a positive amount with up to 2 decimals."),
  ),
  dailyLossLimit: optionalMoney("Daily loss limit"),
  maxTradesPerDay: z.preprocess(
    (v) => (blankToNull(v) === null ? null : Number(v)),
    z.number({ error: "Max trades per day must be a whole number." }).int("Max trades per day must be a whole number.").min(1).max(1000).nullable(),
  ),
  maxRiskPerTrade: optionalMoney("Max risk per trade"),
});

export type FieldErrors = Record<string, string[] | undefined>;

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Submitted values, echoed back so a form keeps its input after an error. */
  values?: Record<string, string>;
  /** Changes on every failed submission so the form can remount with `values`. */
  attempt?: number;
};

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export const settingsSchema = z.object({
  timeZone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
});
