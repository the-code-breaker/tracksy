import { describe, it, expect } from "vitest";
import { itemizedShares } from "@tracksy/finance";
import { expenseSchema } from "@tracksy/validation";
describe("itemized receipts", () => {
  it("allocates shared quantities, tax, tip and a discount transparently", () => {
    const items = [
      {
        description: "Meal",
        amount_minor: 1000,
        allocations: [
          { user_id: "a", value: 2 },
          { user_id: "b", value: 1 },
        ],
      },
      {
        description: "Tax",
        amount_minor: 100,
        allocations: [
          { user_id: "a", value: 2 },
          { user_id: "b", value: 1 },
        ],
      },
      {
        description: "Tip",
        amount_minor: 100,
        allocations: [
          { user_id: "a", value: 1 },
          { user_id: "b", value: 1 },
        ],
      },
      {
        description: "Discount",
        amount_minor: -200,
        allocations: [
          { user_id: "a", value: 1 },
          { user_id: "b", value: 1 },
        ],
      },
    ];
    expect(itemizedShares(1000, items)).toEqual({ a: 684, b: 316 });
  });
  it("rejects an item total mismatch and discounts exceeding a person’s share", () => {
    expect(() =>
      itemizedShares(100, [
        {
          description: "Item",
          amount_minor: 99,
          allocations: [{ user_id: "a", value: 1 }],
        },
      ]),
    ).toThrow("add up");
    expect(() =>
      itemizedShares(50, [
        {
          description: "A",
          amount_minor: 100,
          allocations: [{ user_id: "a", value: 1 }],
        },
        {
          description: "Discount for B",
          amount_minor: -50,
          allocations: [{ user_id: "b", value: 1 }],
        },
      ]),
    ).toThrow("discount");
  });
  it("rejects overprecise or fractional financial payloads", () => {
    expect(expenseSchema.safeParse({ amount_minor: 1.5 }).success).toBe(false);
  });
});
