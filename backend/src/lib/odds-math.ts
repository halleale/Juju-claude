// Pure pricing math. Everything here is deterministic and unit-tested.

export function americanToDecimal(american: number): number {
  if (american === 0 || !Number.isFinite(american)) {
    throw new RangeError(`invalid American odds: ${american}`);
  }
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
}

export function decimalToAmerican(decimal: number): number {
  if (!(decimal > 1)) throw new RangeError(`invalid decimal odds: ${decimal}`);
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

export function probabilityToAmerican(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`invalid probability: ${p}`);
  return decimalToAmerican(1 / p);
}

/** Bookmaker margin ("vig") as a fraction, e.g. 0.045 for a -110/-110 market. */
export function overround(decimals: number[]): number {
  return decimals.reduce((s, d) => s + 1 / d, 0) - 1;
}

/** Proportional (multiplicative) vig removal. */
export function devigMultiplicative(decimals: number[]): number[] {
  const implied = decimals.map(impliedProbability);
  const total = implied.reduce((a, b) => a + b, 0);
  return implied.map((p) => p / total);
}

/**
 * Power-method vig removal: find k such that sum(p_i^k) = 1.
 * It shades longshots more than favourites, which matches the
 * favourite-longshot bias seen in real betting markets better than
 * the multiplicative method does.
 */
export function devigPower(decimals: number[]): number[] {
  const implied = decimals.map(impliedProbability);
  const sumAt = (k: number) => implied.reduce((s, p) => s + p ** k, 0);
  if (Math.abs(sumAt(1) - 1) < 1e-12) return implied;
  // sum(p^k) is decreasing in k for p in (0,1); bracket and bisect.
  let lo = 0.5;
  let hi = 2;
  while (sumAt(lo) < 1) lo /= 2;
  while (sumAt(hi) > 1) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) > 1) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  const probs = implied.map((p) => p ** k);
  const total = probs.reduce((a, b) => a + b, 0);
  return probs.map((p) => p / total);
}

/** Expected value per unit staked at the given decimal price. */
export function expectedValue(trueProbability: number, decimal: number): number {
  return trueProbability * decimal - 1;
}

/** Full-Kelly stake as a fraction of bankroll (0 when there is no edge). */
export function kellyFraction(trueProbability: number, decimal: number): number {
  const b = decimal - 1;
  const f = (b * trueProbability - (1 - trueProbability)) / b;
  return Math.max(0, f);
}

export function weightedMean(values: number[], weights: number[]): number {
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    num += v * weights[i]!;
    den += weights[i]!;
  });
  return den === 0 ? NaN : num / den;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
