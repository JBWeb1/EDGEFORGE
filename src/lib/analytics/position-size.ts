import Decimal from "decimal.js";

/**
 * Position sizing from a fixed risk budget: how much can be bought or sold so
 * that hitting the stop loses no more than the budget.
 */

export type SizingInput = {
  /** Risk budget as an amount... */
  riskAmount?: Decimal.Value | null;
  /** ...or as a percentage of `balance`. */
  riskPercent?: Decimal.Value | null;
  balance?: Decimal.Value | null;
  entry: Decimal.Value;
  stop: Decimal.Value;
  target?: Decimal.Value | null;
  multiplier?: Decimal.Value | null;
  /** Smallest tradable increment (1 share, 0.01 lots, 0.001 BTC...). */
  step?: Decimal.Value | null;
};

export type SizingResult =
  | { ok: false; error: string }
  | {
      ok: true;
      riskBudget: Decimal;
      riskPerUnit: Decimal;
      quantity: Decimal;
      /** Risk at the rounded-down quantity; never above the budget. */
      actualRisk: Decimal;
      positionValue: Decimal;
      direction: "LONG" | "SHORT";
      reward: Decimal | null;
      rewardRisk: Decimal | null;
    };

const pos = (v: Decimal.Value | null | undefined) => (v === null || v === undefined || v === "" ? null : new Decimal(v));

export function positionSize(input: SizingInput): SizingResult {
  try {
    const entry = new Decimal(input.entry);
    const stop = new Decimal(input.stop);
    const multiplier = pos(input.multiplier) ?? new Decimal(1);
    const step = pos(input.step) ?? new Decimal(1);
    if (!entry.gt(0) || !stop.gt(0)) return { ok: false, error: "Entry and stop must be positive prices." };
    if (entry.eq(stop)) return { ok: false, error: "The stop must differ from the entry." };
    if (!multiplier.gt(0) || !step.gt(0)) return { ok: false, error: "Multiplier and step must be positive." };

    let riskBudget = pos(input.riskAmount);
    if (!riskBudget) {
      const pct = pos(input.riskPercent);
      const balance = pos(input.balance);
      if (!pct || !balance) return { ok: false, error: "Enter a risk amount, or a balance and risk %." };
      riskBudget = balance.mul(pct).div(100);
    }
    if (!riskBudget.gt(0)) return { ok: false, error: "Risk must be greater than zero." };

    const direction = stop.lt(entry) ? "LONG" : "SHORT";
    const riskPerUnit = entry.minus(stop).abs().mul(multiplier);
    const quantity = riskBudget.div(riskPerUnit).div(step).floor().mul(step);
    if (quantity.isZero()) {
      return { ok: false, error: `The budget is smaller than the risk of the minimum size (${step.toString()}).` };
    }
    const actualRisk = quantity.mul(riskPerUnit);

    const target = pos(input.target);
    let reward: Decimal | null = null;
    let rewardRisk: Decimal | null = null;
    if (target) {
      const rightSide = direction === "LONG" ? target.gt(entry) : target.lt(entry);
      if (!rightSide) return { ok: false, error: `For a ${direction.toLowerCase()} the target must be ${direction === "LONG" ? "above" : "below"} the entry.` };
      reward = target.minus(entry).abs().mul(multiplier).mul(quantity);
      rewardRisk = reward.div(actualRisk);
    }

    return {
      ok: true,
      riskBudget,
      riskPerUnit,
      quantity,
      actualRisk,
      positionValue: quantity.mul(entry).mul(multiplier),
      direction,
      reward,
      rewardRisk,
    };
  } catch {
    return { ok: false, error: "Enter valid numbers." };
  }
}
