import {
  currencyDigits,
  type Currency,
  type ReceiptItem,
} from "@tracksy/domain";
export const MAX_MINOR = 999_999_999_999;
export function integer(value: number, allowZero = true): void {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > MAX_MINOR
  )
    throw new Error("Invalid integer amount");
}
export function parseMoney(value: string, currency: Currency): number {
  const digits = currencyDigits[currency];
  if (
    digits === undefined ||
    !new RegExp(`^\\d+(?:\\.\\d{1,${digits || 1}})?$`).test(value) ||
    (digits === 0 && value.includes("."))
  )
    throw new Error("Enter a valid amount with the correct currency precision");
  const [whole = "0", fraction = ""] = value.split(".");
  const result =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (result > BigInt(MAX_MINOR)) throw new Error("Amount too large");
  return Number(result);
}
export function formatMoney(
  minor: number,
  currency: Currency,
  locale = "en-IN",
): string {
  if (!Number.isSafeInteger(minor)) throw new Error("Invalid amount");
  // Floating point is used only for display; stored amounts and arithmetic are integers.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currencyDigits[currency],
  }).format(minor / 10 ** currencyDigits[currency]);
}
export interface Allocation {
  user_id: string;
  value: number;
}
/** Largest-remainder allocation, with user ID as a stable tie breaker. */
export function allocate(
  total: number,
  participants: Allocation[],
): Record<string, number> {
  integer(total, false);
  if (
    !participants.length ||
    new Set(participants.map((p) => p.user_id)).size !== participants.length
  )
    throw new Error("Unique participants required");
  for (const p of participants) {
    integer(p.value);
    if (!p.user_id) throw new Error("Participant required");
  }
  const denominator = participants.reduce((s, p) => s + BigInt(p.value), 0n);
  if (!denominator) throw new Error("Positive weights required");
  const rows = participants.map((p) => ({
    id: p.user_id,
    amount: (BigInt(total) * BigInt(p.value)) / denominator,
    remainder: (BigInt(total) * BigInt(p.value)) % denominator,
  }));
  let left = BigInt(total) - rows.reduce((s, r) => s + r.amount, 0n);
  rows.sort((a, b) =>
    a.remainder === b.remainder
      ? a.id.localeCompare(b.id)
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const row of rows) {
    if (left > 0n) {
      row.amount++;
      left--;
    }
  }
  return Object.fromEntries(rows.map((r) => [r.id, Number(r.amount)]));
}
export function split(
  total: number,
  method: string,
  participants: Allocation[],
): Record<string, number> {
  integer(total, false);
  if (
    !participants.length ||
    new Set(participants.map((p) => p.user_id)).size !== participants.length
  )
    throw new Error("Unique participants required");
  if (method === "equal")
    return allocate(
      total,
      participants.map((p) => ({ ...p, value: 1 })),
    );
  for (const p of participants) integer(p.value);
  if (method === "exact" || method === "custom" || method === "itemized") {
    if (
      participants.reduce((s, p) => s + BigInt(p.value), 0n) !== BigInt(total)
    )
      throw new Error("Shares must equal the total");
    return Object.fromEntries(participants.map((p) => [p.user_id, p.value]));
  }
  if (
    method === "percentage" &&
    participants.reduce((s, p) => s + BigInt(p.value), 0n) !== 10000n
  )
    throw new Error("Percentages must total 10000 basis points");
  if (method !== "weighted" && method !== "percentage")
    throw new Error("Unknown split method");
  return allocate(total, participants);
}
export function ledger(
  total: number,
  payers: { user_id: string; amount_minor: number }[],
  shares: Record<string, number>,
): Record<string, number> {
  integer(total, false);
  for (const [id, value] of Object.entries(shares)) {
    if (!id) throw new Error("Participant required");
    integer(value);
  }
  if (new Set(payers.map((p) => p.user_id)).size !== payers.length)
    throw new Error("Duplicate payer");
  for (const p of payers) integer(p.amount_minor);
  if (payers.some((p) => !p.user_id)) throw new Error("Payer required");
  if (payers.reduce((s, p) => s + BigInt(p.amount_minor), 0n) !== BigInt(total))
    throw new Error("Payers must fund the total");
  if (
    Object.values(shares).reduce((s, v) => s + BigInt(v), 0n) !== BigInt(total)
  )
    throw new Error("Shares do not match");
  const result: Record<string, number> = {};
  for (const [id, share] of Object.entries(shares)) result[id] = -share;
  for (const p of payers)
    result[p.user_id] = (result[p.user_id] ?? 0) + p.amount_minor;
  return result;
}
export function suggestSettlements(
  balances: { user_id: string; balance_minor: number }[],
): { from: string; to: string; amount_minor: number }[] {
  if (balances.reduce((s, b) => s + BigInt(b.balance_minor), 0n) !== 0n)
    throw new Error("Balances must sum to zero");
  const debtors = balances
    .filter((b) => b.balance_minor < 0)
    .map((b) => ({ ...b, left: -b.balance_minor }))
    .sort((a, b) => b.left - a.left || a.user_id.localeCompare(b.user_id));
  const creditors = balances
    .filter((b) => b.balance_minor > 0)
    .map((b) => ({ ...b, left: b.balance_minor }))
    .sort((a, b) => b.left - a.left || a.user_id.localeCompare(b.user_id));
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = Math.min(d.left, c.left);
    transfers.push({ from: d.user_id, to: c.user_id, amount_minor: amount });
    d.left -= amount;
    c.left -= amount;
    if (!d.left) i++;
    if (!c.left) j++;
  }
  return transfers;
}
export function itemizedShares(
  total: number,
  items: ReceiptItem[],
): Record<string, number> {
  integer(total, false);
  if (!items.length || items.length > 100)
    throw new Error("Add 1 to 100 receipt items");
  if (items.reduce((s, i) => s + BigInt(i.amount_minor), 0n) !== BigInt(total))
    throw new Error("Items, tax, tips and discounts must add up to the total");
  const result: Record<string, number> = {};
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.amount_minor) ||
      item.amount_minor === 0 ||
      Math.abs(item.amount_minor) > MAX_MINOR
    )
      throw new Error("Invalid item amount");
    const shares = allocate(Math.abs(item.amount_minor), item.allocations);
    for (const [id, share] of Object.entries(shares))
      result[id] = (result[id] ?? 0) + (item.amount_minor < 0 ? -share : share);
  }
  if (Object.values(result).some((v) => v < 0))
    throw new Error("A discount cannot exceed a participant’s item total");
  return result;
}
