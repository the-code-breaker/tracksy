import { describe, it, expect } from "vitest";
import type { Group, Balance } from "@tracksy/domain";
import {
  filterGroups,
  memberBalances,
} from "../apps/mobile/src/lib/group-list";
const group = (id: string, archived = false): Group => ({
  id,
  name: id,
  currency: "INR",
  kind: "friends",
  icon: "◈",
  description: "",
  archived_at: archived ? "2026-11-04" : null,
  created_at: "2026-11-04",
  simplified_settlements: true,
});
const groups = [
  group("Trip"),
  group("Home"),
  group("Old trip", true),
  group("Empty"),
];
const balance = (
  group_id: string,
  currency: Balance["currency"],
  balance_minor: number,
  user_id = "me",
): Balance => ({ group_id, currency, balance_minor, user_id });
const balances = [
  balance("Trip", "INR", 0),
  balance("Trip", "USD", -4200),
  balance("Trip", "EUR", 1900),
  balance("Home", "INR", 1200),
  balance("Home", "USD", -1, "other"),
  balance("Old trip", "INR", -300),
];
describe("group card balances and filters", () => {
  it("shows every outstanding currency without offsetting unlike currencies or other members", () => {
    expect(memberBalances(balances, groups[0]!, "me")).toEqual([
      { currency: "EUR", amount: 1900 },
      { currency: "USD", amount: -4200 },
    ]);
    expect(memberBalances(balances, groups[3]!, "me")).toEqual([
      { currency: "INR", amount: 0 },
    ]);
  });
  it("filters archived, owed, owing and settled groups with search applied", () => {
    const ids = (f: Parameters<typeof filterGroups>[4], search = "") =>
      filterGroups(groups, balances, "me", search, f).map((g) => g.id);
    expect(ids("Active")).toEqual(["Trip", "Home", "Empty"]);
    expect(ids("All")).toHaveLength(4);
    expect(ids("Archived")).toEqual(["Old trip"]);
    expect(ids("You owe")).toEqual(["Trip"]);
    expect(ids("You are owed")).toEqual(["Trip", "Home"]);
    expect(ids("Settled")).toEqual(["Empty"]);
    expect(ids("All", "  TRIP  ")).toEqual(["Trip", "Old trip"]);
  });
});
