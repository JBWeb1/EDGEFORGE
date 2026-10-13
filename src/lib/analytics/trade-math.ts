import Decimal from "decimal.js";

/**
 * Per-trade calculations. All money math is done with decimal.js so that
 * results are exact for the decimal prices and fees traders enter.
 */

export type Direction = "LONG" | "SHORT";

export type TradeInput = {
  id: string;
  symbol: string;
  direction: Direction;
  quantity: Decimal.Value;
  /** Account-currency value of a 1.0 price move per unit. Defaults to 1. */
  multiplier?: Decimal.Value | null;
  entryPrice: Decimal.Value;
  entryAt: Date;
  exitPrice: Decimal.Value | null;
  exitAt: Date | null;
  stopLoss?: Decimal.Value | null;
  takeProfit?: Decimal.Value | null;
  fees?: Decimal.Value | null;
  setup?: string | null;
  strategy?: string | null;
  emotion?: string | null;
  followedRules?: boolean | null;
  tags?: string[];
};

export type Outcome = "WIN" | "LOSS" | "BREAKEVEN";

export type TradeResult = {
  trade: TradeInput;
  /** Price P&L before fees. */
  grossPnl: Decimal;
  /** P&L after fees. This is the figure every statistic is based on. */
  netPnl: Decimal;
  fees: Decimal;
  outcome: Outcome;
  /** Money at risk between entry and stop loss, or null when no stop was set. */
  initialRisk: Decimal | null;
  /** Net P&L expressed in units of initial risk (R), or null without a stop. */
  rMultiple: Decimal | null;
  /** Planned reward-to-risk from the stop loss and take profit, if both set. */
  plannedRewardRisk: Decimal | null;
  /** Holding time in milliseconds. */
  holdingMs: number | null;
};

export type ClosedTrade = TradeInput & { exitPrice: Decimal.Value; exitAt: Date };

export function isClosed(trade: TradeInput): trade is ClosedTrade {
  return trade.exitPrice !== null && trade.exitPrice !== undefined && trade.exitAt !== null;
}

const sign = (direction: Direction) => (direction === "LONG" ? 1 : -1);

/** Value of a price distance for this trade's size, in account currency. */
function moveValue(trade: TradeInput, priceDistance: Decimal): Decimal {
  return priceDistance
    .mul(new Decimal(trade.quantity))
    .mul(new Decimal(trade.multiplier ?? 1));
}

/** Money at risk between entry and stop loss; null without a usable stop. Works for open trades too. */
export function computeInitialRisk(trade: TradeInput): Decimal | null {
  if (trade.stopLoss === null || trade.stopLoss === undefined) return null;
  const stopDistance = new Decimal(trade.entryPrice).minus(new Decimal(trade.stopLoss)).abs();
  return stopDistance.gt(0) ? moveValue(trade, stopDistance) : null;
}

export function computeTradeResult(trade: ClosedTrade): TradeResult {
  const entry = new Decimal(trade.entryPrice);
  const exit = new Decimal(trade.exitPrice);
  const fees = new Decimal(trade.fees ?? 0);

  const grossPnl = moveValue(trade, exit.minus(entry)).mul(sign(trade.direction));
  const netPnl = grossPnl.minus(fees);

  const initialRisk = computeInitialRisk(trade);
  let plannedRewardRisk: Decimal | null = null;
  if (initialRisk && trade.takeProfit !== null && trade.takeProfit !== undefined) {
    const stopDistance = entry.minus(new Decimal(trade.stopLoss!)).abs();
    plannedRewardRisk = new Decimal(trade.takeProfit).minus(entry).abs().div(stopDistance);
  }

  return {
    trade,
    grossPnl,
    netPnl,
    fees,
    outcome: netPnl.gt(0) ? "WIN" : netPnl.lt(0) ? "LOSS" : "BREAKEVEN",
    initialRisk,
    rMultiple: initialRisk && initialRisk.gt(0) ? netPnl.div(initialRisk) : null,
    plannedRewardRisk,
    holdingMs: trade.exitAt.getTime() - trade.entryAt.getTime(),
  };
}

/** Results for every closed trade, ordered by exit time (oldest first). */
export function computeClosedResults(trades: TradeInput[]): TradeResult[] {
  return trades
    .filter(isClosed)
    .map(computeTradeResult)
    .sort(
      (a, b) =>
        a.trade.exitAt!.getTime() - b.trade.exitAt!.getTime() ||
        a.trade.entryAt.getTime() - b.trade.entryAt.getTime() ||
        a.trade.id.localeCompare(b.trade.id),
    );
}
