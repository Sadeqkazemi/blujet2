export interface PenaltyRule {
  minHoursBeforeDeparture: number;
  penaltyPct: number;
  labelFa: string;
}

export interface PenaltyResult {
  penaltyPct: number;
  penaltyAmountIrr: number;
  refundableIrr: number;
  ruleLabelFa: string;
}

/**
 * Pure fare-rule penalty computation (design's 4-bracket engine, seeded in
 * RefundPenaltyRule): picks the rule with the highest threshold that
 * `hoursLeft` still satisfies. All money integer IRR.
 */
export function computePenalty(
  rules: PenaltyRule[],
  hoursLeft: number,
  totalPaidIrr: number,
): PenaltyResult {
  const sorted = [...rules].sort(
    (a, b) => b.minHoursBeforeDeparture - a.minHoursBeforeDeparture,
  );
  const rule =
    sorted.find((r) => hoursLeft >= r.minHoursBeforeDeparture) ??
    sorted[sorted.length - 1];

  const penaltyAmountIrr = Math.round((totalPaidIrr * rule.penaltyPct) / 100);
  return {
    penaltyPct: rule.penaltyPct,
    penaltyAmountIrr,
    refundableIrr: totalPaidIrr - penaltyAmountIrr,
    ruleLabelFa: rule.labelFa,
  };
}
