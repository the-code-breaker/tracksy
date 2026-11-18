import { describe, it, expect } from "vitest";
import {
  allocate,
  split,
  ledger,
  parseMoney,
  suggestSettlements,
  MAX_MINOR,
} from "@tracksy/finance";
describe("exact financial arithmetic", () => {
  it("parses currency precision without binary arithmetic", () => {
    expect(parseMoney("19.99", "INR")).toBe(1999);
    expect(parseMoney("1.001", "KWD")).toBe(1001);
    expect(parseMoney("7", "JPY")).toBe(7);
    for (const amount of ["1.111", "-1", "1e3", "NaN"])
      expect(() => parseMoney(amount, "USD")).toThrow();
    expect(() => parseMoney("1.0", "JPY")).toThrow();
  });
  it("allocates odd remainders deterministically regardless of input order", () => {
    const p = [
      { user_id: "c", value: 1 },
      { user_id: "a", value: 1 },
      { user_id: "b", value: 1 },
    ];
    expect(allocate(100, p)).toEqual({ a: 34, b: 33, c: 33 });
    expect(allocate(100, p.reverse())).toEqual({ a: 34, b: 33, c: 33 });
  });
  it("handles exact, custom, weighted and percentage splits", () => {
    expect(
      split(100, "exact", [
        { user_id: "a", value: 70 },
        { user_id: "b", value: 30 },
      ]),
    ).toEqual({ a: 70, b: 30 });
    expect(
      split(100, "custom", [
        { user_id: "a", value: 70 },
        { user_id: "b", value: 30 },
      ]),
    ).toEqual({ a: 70, b: 30 });
    expect(
      split(101, "weighted", [
        { user_id: "a", value: 2 },
        { user_id: "b", value: 1 },
      ]),
    ).toEqual({ a: 67, b: 34 });
    expect(
      split(101, "percentage", [
        { user_id: "a", value: 5000 },
        { user_id: "b", value: 5000 },
      ]),
    ).toEqual({ a: 51, b: 50 });
  });
  it("rejects invalid totals, duplicate participants and invalid percentage totals", () => {
    expect(() => split(100, "exact", [{ user_id: "a", value: 99 }])).toThrow();
    expect(() =>
      split(100, "weighted", [{ user_id: "a", value: 0 }]),
    ).toThrow();
    expect(() =>
      split(100, "equal", [
        { user_id: "a", value: 1 },
        { user_id: "a", value: 1 },
      ]),
    ).toThrow();
    expect(() =>
      split(100, "percentage", [{ user_id: "a", value: 9999 }]),
    ).toThrow();
    expect(() => allocate(-1, [{ user_id: "a", value: 1 }])).toThrow();
  });
  it("balances a multiple-payer ledger", () => {
    const entries = ledger(
      100,
      [
        { user_id: "a", amount_minor: 70 },
        { user_id: "b", amount_minor: 30 },
      ],
      { a: 40, b: 40, c: 20 },
    );
    expect(entries).toEqual({ a: 30, b: -10, c: -20 });
    expect(Object.values(entries).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("uses BigInt for overflow-safe intermediate multiplication", () => {
    const shares = allocate(MAX_MINOR, [
      { user_id: "a", value: MAX_MINOR },
      { user_id: "b", value: MAX_MINOR - 1 },
    ]);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(MAX_MINOR);
  });
  it("conserves totals for generated splits", () => {
    for (let n = 1; n <= 40; n++)
      for (let amount = 1; amount < 500; amount += 17) {
        const parts = Array.from({ length: n }, (_, i) => ({
          user_id: String(i).padStart(3, "0"),
          value: (i + 1) * 7919,
        }));
        const shares = allocate(amount, parts);
        expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(amount);
        expect(
          Object.values(shares).every((v) => Number.isInteger(v) && v >= 0),
        ).toBe(true);
      }
  });
  it("suggests transfers without mutating balances", () => {
    const balances = [
      { user_id: "a", balance_minor: 80 },
      { user_id: "b", balance_minor: -30 },
      { user_id: "c", balance_minor: -50 },
    ];
    const before = JSON.stringify(balances);
    expect(suggestSettlements(balances)).toEqual([
      { from: "c", to: "a", amount_minor: 50 },
      { from: "b", to: "a", amount_minor: 30 },
    ]);
    expect(JSON.stringify(balances)).toBe(before);
  });
});
