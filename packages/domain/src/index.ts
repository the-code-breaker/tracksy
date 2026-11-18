export type Currency = "INR" | "USD" | "EUR" | "GBP" | "JPY" | "KWD";
export const currencyDigits: Record<Currency, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KWD: 3,
};
export type SplitMethod =
  "equal" | "exact" | "percentage" | "weighted" | "itemized" | "custom";
export type Feature =
  | "receipt_scan"
  | "itemized"
  | "budgets"
  | "analytics"
  | "settlement_plan"
  | "recurring"
  | "assistant"
  | "reports"
  | "custom_rules"
  | "reminders";
export interface Member {
  user_id: string;
  display_name: string;
  role: "owner" | "admin" | "member";
  active: boolean;
}
export interface Group {
  id: string;
  name: string;
  description: string;
  currency: Currency;
  kind: string;
  icon: string;
  archived_at: string | null;
  created_at: string;
  simplified_settlements: boolean;
}
export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount_minor: number;
  currency: Currency;
  category: string;
  split_method: SplitMethod;
  expense_date: string;
  created_by: string;
  version: number;
  reversed_at: string | null;
  notes: string;
}
export interface Balance {
  group_id: string;
  user_id: string;
  currency: Currency;
  balance_minor: number;
}
export interface Activity {
  id: string;
  group_id: string;
  actor_id: string;
  event_type: string;
  entity_id: string | null;
  created_at: string;
  detail: Record<string, unknown>;
}
export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount_minor: number;
  currency: Currency;
  status: "pending" | "confirmed" | "disputed" | "reversed";
  method: string;
  notes: string;
  created_at: string;
  created_by: string;
}
export interface Entitlement {
  group_id: string;
  status: string;
  expires_at: string;
  purchaser_id: string;
  renews: boolean;
}
export interface ReceiptItem {
  description: string;
  amount_minor: number;
  allocations: { user_id: string; value: number }[];
}
export interface ExpenseInput {
  group_id: string;
  description: string;
  amount_minor: number;
  currency: Currency;
  category: string;
  split_method: SplitMethod;
  participants: { user_id: string; value: number }[];
  payers: { user_id: string; amount_minor: number }[];
  expense_date: string;
  notes: string;
  idempotency_key: string;
  replaces_id?: string;
  expected_version?: number;
  items?: ReceiptItem[];
}
