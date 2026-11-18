import type { Balance, Currency, Group } from "@tracksy/domain";
export const groupFilters = [
  "Active",
  "All",
  "You owe",
  "You are owed",
  "Settled",
  "Archived",
] as const;
export type GroupFilter = (typeof groupFilters)[number];
export function memberBalances(rows: Balance[], group: Group, user?: string) {
  const totals = new Map<Currency, number>();
  for (const row of rows)
    if (row.group_id === group.id && row.user_id === user)
      totals.set(
        row.currency,
        (totals.get(row.currency) || 0) + Number(row.balance_minor),
      );
  const nonzero = [...totals]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    nonzero.length ? nonzero : ([[group.currency, 0]] as [Currency, number][])
  ).map(([currency, amount]) => ({ currency, amount }));
}
export function filterGroups(
  groups: Group[],
  balances: Balance[],
  user: string | undefined,
  search: string,
  filter: GroupFilter,
) {
  return groups.filter((group) => {
    if (!group.name.toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    if (filter === "Archived") return !!group.archived_at;
    if (filter !== "All" && group.archived_at) return false;
    const amounts = memberBalances(balances, group, user);
    if (filter === "You owe") return amounts.some((b) => b.amount < 0);
    if (filter === "You are owed") return amounts.some((b) => b.amount > 0);
    if (filter === "Settled") return amounts.every((b) => b.amount === 0);
    return true;
  });
}
