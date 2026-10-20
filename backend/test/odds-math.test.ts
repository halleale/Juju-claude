import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  decimalToAmerican,
  devigMultiplicative,
  devigPower,
  expectedValue,
  kellyFraction,
  overround,
} from "../src/lib/odds-math.js";

describe("odds conversions", () => {
  it("converts American to decimal", () => {
    expect(americanToDecimal(100)).toBe(2);
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(-200)).toBe(1.5);
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 4);
  });

  it("round-trips decimal to American", () => {
    for (const a of [-400, -150, -110, 100, 120, 350]) {
      expect(decimalToAmerican(americanToDecimal(a))).toBe(a);
    }
  });

  it("rejects invalid odds", () => {
    expect(() => americanToDecimal(0)).toThrow();
    expect(() => decimalToAmerican(1)).toThrow();
  });
});

describe("vig removal", () => {
  const standard = [americanToDecimal(-110), americanToDecimal(-110)];

  it("measures the overround of a -110/-110 market", () => {
    expect(overround(standard)).toBeCloseTo(0.0476, 3);
  });

  it("splits a symmetric market 50/50 with either method", () => {
    for (const p of [...devigMultiplicative(standard), ...devigPower(standard)]) {
      expect(p).toBeCloseTo(0.5, 9);
    }
  });

  it("produces probabilities that sum to 1 for 2- and 3-way markets", () => {
    const threeWay = [2.1, 3.4, 3.6];
    for (const probs of [devigPower(threeWay), devigPower([1.4, 3.1])]) {
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
  });

  it("shades the longshot more under the power method", () => {
    const market = [americanToDecimal(-300), americanToDecimal(240)];
    const mult = devigMultiplicative(market);
    const power = devigPower(market);
    expect(power[1]!).toBeLessThan(mult[1]!);
    expect(power[0]!).toBeGreaterThan(mult[0]!);
  });
});

describe("EV and Kelly", () => {
  it("computes expected value", () => {
    expect(expectedValue(0.5, 2.1)).toBeCloseTo(0.05, 9);
    expect(expectedValue(0.5, 1.9)).toBeCloseTo(-0.05, 9);
  });

  it("sizes Kelly stakes and never goes negative", () => {
    // Even money with a 55% edge -> 10% of bankroll.
    expect(kellyFraction(0.55, 2)).toBeCloseTo(0.1, 9);
    expect(kellyFraction(0.45, 2)).toBe(0);
  });
});
