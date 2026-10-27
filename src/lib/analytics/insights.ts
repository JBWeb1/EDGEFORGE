import Decimal from "decimal.js";
import { summarizeExcursions } from "./excursion";
import { breakdown, summarize, type BreakdownRow } from "./metrics";
import type { TradeResult } from "./trade-math";

/**
 * Deterministic, rule-based insights. Every insight lists the exact figures it
 * was derived from, so a trader can verify it against their own journal.
 * Groups smaller than MIN_SAMPLE are never used to draw conclusions.
 */

export const MIN_SAMPLE = 5;

export type Insight = {
  id: string;
  tone: "positive" | "negative" | "neutral";
  title: string;
  detail: string;
  evidence: { label: string; value: string }[];
};

const money = (d: Decimal) => {
  const n = d.toDecimalPlaces(2).toNumber();
  return `${n < 0 ? "-" : n > 0 ? "+" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
/** Unsigned amount, for sentences that already say "lost" or "returned". */
const amount = (d: Decimal) => money(d.abs()).replace(/^[+-]/, "");
const pct = (n: number) => `${n.toFixed(1)}%`;

const rowEvidence = (row: BreakdownRow) => [
  { label: `${row.key}: trades`, value: String(row.trades) },
  { label: `${row.key}: win rate`, value: pct(row.winRate) },
  { label: `${row.key}: net P&L`, value: money(row.netPnl) },
  { label: `${row.key}: avg per trade`, value: money(row.expectancy) },
];

function compareGroups(
  results: TradeResult[],
  by: "rules" | "direction",
  a: string,
  b: string,
): [BreakdownRow, BreakdownRow] | null {
  const rows = breakdown(results, by);
  const ra = rows.find((r) => r.key === a);
  const rb = rows.find((r) => r.key === b);
  if (!ra || !rb || ra.trades < MIN_SAMPLE || rb.trades < MIN_SAMPLE) return null;
  return [ra, rb];
}

export function generateInsights(results: TradeResult[]): Insight[] {
  const insights: Insight[] = [];

  if (results.length < MIN_SAMPLE) {
    return [
      {
        id: "sample-size",
        tone: "neutral",
        title: "Not enough closed trades yet",
        detail: `Insights need at least ${MIN_SAMPLE} closed trades. Keep journaling — conclusions drawn from a handful of trades are mostly noise.`,
        evidence: [{ label: "Closed trades", value: String(results.length) }],
      },
    ];
  }

  // Rule adherence.
  const rules = compareGroups(results, "rules", "Followed rules", "Broke rules");
  if (rules) {
    const [followed, broke] = rules;
    const better = followed.expectancy.gt(broke.expectancy);
    insights.push({
      id: "rules",
      tone: better ? "positive" : "negative",
      title: better
        ? "Your edge is in following your rules"
        : "Rule-breaking trades are outperforming — review your rules",
      detail: better
        ? `Trades taken within your rules average ${money(followed.expectancy)} per trade versus ${money(broke.expectancy)} when rules were broken.`
        : `Trades marked as rule breaks average ${money(broke.expectancy)} versus ${money(followed.expectancy)} for rule-following trades. Your written rules may not match how you actually make money.`,
      evidence: [...rowEvidence(followed), ...rowEvidence(broke)],
    });
  }

  // Best and worst setups.
  const setups = breakdown(results, "setup").filter((r) => r.trades >= MIN_SAMPLE && r.key !== "No setup");
  if (setups.length >= 2) {
    const best = setups[0];
    const worst = setups[setups.length - 1];
    insights.push({
      id: "best-setup",
      tone: "positive",
      title: `"${best.key}" is your strongest setup`,
      detail: `Across ${best.trades} trades it returned ${money(best.netPnl)} with a ${pct(best.winRate)} win rate.`,
      evidence: rowEvidence(best),
    });
    if (worst.netPnl.lt(0)) {
      insights.push({
        id: "worst-setup",
        tone: "negative",
        title: `"${worst.key}" is costing you money`,
        detail: `Across ${worst.trades} trades it lost ${amount(worst.netPnl)} in total. Consider reducing size or pausing it until you can define what separates its winners from its losers.`,
        evidence: rowEvidence(worst),
      });
    }
  }

  // Long vs short.
  const sides = compareGroups(results, "direction", "Long", "Short");
  if (sides) {
    const [long, short] = sides;
    const diff = long.expectancy.minus(short.expectancy).abs();
    const overall = summarize(results).expectancy!.abs();
    if (overall.gt(0) && diff.gt(overall)) {
      const stronger = long.expectancy.gt(short.expectancy) ? long : short;
      const weaker = stronger === long ? short : long;
      insights.push({
        id: "direction",
        tone: "neutral",
        title: `You trade ${stronger.key.toLowerCase()} positions noticeably better`,
        detail: `${stronger.key} trades average ${money(stronger.expectancy)} per trade versus ${money(weaker.expectancy)} for ${weaker.key.toLowerCase()} trades.`,
        evidence: [...rowEvidence(stronger), ...rowEvidence(weaker)],
      });
    }
  }

  // Emotional states that coincide with losses.
  const emotions = breakdown(results, "emotion").filter(
    (r) => r.trades >= MIN_SAMPLE && r.key !== "Not recorded" && r.netPnl.lt(0),
  );
  const costliest = emotions.sort((a, b) => a.netPnl.comparedTo(b.netPnl))[0];
  if (costliest) {
    insights.push({
      id: "emotion",
      tone: "negative",
      title: `Trades logged as "${costliest.key.toLowerCase()}" are net losers`,
      detail: `This is a correlation in your journal, not a diagnosis: the ${costliest.trades} trades where you recorded feeling ${costliest.key.toLowerCase()} lost ${amount(costliest.netPnl)} in total.`,
      evidence: rowEvidence(costliest),
    });
  }

  // Playbook grades: does following the checklist pay?
  const grades = breakdown(results, "grade");
  const gradeA = grades.find((g) => g.key === "Grade A");
  const lower = results.filter((r) => r.trade.grade && r.trade.grade !== "A");
  if (gradeA && gradeA.trades >= MIN_SAMPLE && lower.length >= MIN_SAMPLE) {
    const rest = summarize(lower);
    const restRow: BreakdownRow = {
      key: "Grades B–D",
      trades: rest.closedTrades,
      wins: rest.wins,
      winRate: rest.winRate ?? 0,
      netPnl: rest.netPnl,
      expectancy: rest.expectancy!,
      profitFactor: rest.profitFactor,
      averageR: rest.averageR,
    };
    const better = gradeA.expectancy.gt(restRow.expectancy);
    insights.push({
      id: "grades",
      tone: better ? "positive" : "negative",
      title: better ? "A-grade trades are where your money is made" : "Your A-grade trades aren't outperforming",
      detail: better
        ? `Trades that met every playbook rule average ${money(gradeA.expectancy)} versus ${money(restRow.expectancy)} for trades that skipped rules.`
        : `Trades that met every rule average ${money(gradeA.expectancy)} versus ${money(restRow.expectancy)} for the rest. Some of your rules may not be adding edge.`,
      evidence: [...rowEvidence(gradeA), ...rowEvidence(restRow)],
    });
  }

  // Excursions: losers that were comfortably in profit first.
  const ex = summarizeExcursions(results);
  if (ex.losersWithMfeR >= MIN_SAMPLE && ex.losersThatWereUp1R / ex.losersWithMfeR >= 0.3) {
    insights.push({
      id: "gave-back",
      tone: "negative",
      title: `${ex.losersThatWereUp1R} of your losing trades were 1R or more in profit first`,
      detail: "Consider a rule for protecting open profit, such as moving the stop to breakeven or taking partial profit at +1R, and test it against these trades.",
      evidence: [
        { label: "Losers with best price recorded", value: String(ex.losersWithMfeR) },
        { label: "Of those, reached +1R before losing", value: String(ex.losersThatWereUp1R) },
        { label: "Winners' average exit efficiency", value: ex.averageExitEfficiency === null ? "—" : pct(ex.averageExitEfficiency * 100) },
      ],
    });
  }

  // Losing streak awareness.
  const s = summarize(results);
  if (s.longestLossStreak >= 4) {
    insights.push({
      id: "loss-streak",
      tone: "neutral",
      title: `Your longest losing streak is ${s.longestLossStreak} trades`,
      detail: "Size your risk so a streak at least this long cannot do serious damage to your account, and consider a rule to pause after a set number of consecutive losses.",
      evidence: [
        { label: "Longest losing streak", value: String(s.longestLossStreak) },
        { label: "Longest winning streak", value: String(s.longestWinStreak) },
      ],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "no-patterns",
      tone: "neutral",
      title: "No strong patterns yet",
      detail: `Tag trades with a setup, emotion and whether you followed your rules. Patterns appear once a group has at least ${MIN_SAMPLE} closed trades.`,
      evidence: [{ label: "Closed trades", value: String(results.length) }],
    });
  }

  return insights;
}
