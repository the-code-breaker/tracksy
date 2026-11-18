import { z } from "zod";
export const currencySchema = z.enum([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "KWD",
]);
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Enter your password").max(128),
});
export const authSchema = loginSchema.extend({
  password: z.string().min(12, "Use at least 12 characters").max(128),
});
export const groupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
  currency: currencySchema,
  kind: z.enum([
    "friends",
    "roommates",
    "couples",
    "family",
    "travel",
    "events",
    "office",
    "custom",
  ]),
  icon: z.string().max(8).default("◈"),
});
export const expenseSchema = z.object({
  group_id: z.string().uuid(),
  description: z.string().trim().min(1).max(160),
  amount_minor: z.number().int().positive().max(999999999999),
  currency: currencySchema,
  category: z.string().min(1).max(40),
  split_method: z.enum([
    "equal",
    "exact",
    "percentage",
    "weighted",
    "custom",
    "itemized",
  ]),
  participants: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        value: z.number().int().nonnegative().max(999999999999),
      }),
    )
    .min(1)
    .max(100),
  payers: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        amount_minor: z.number().int().nonnegative().max(999999999999),
      }),
    )
    .min(1)
    .max(100),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).default(""),
  idempotency_key: z.string().uuid(),
  replaces_id: z.string().uuid().optional(),
  expected_version: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(160),
        amount_minor: z.number().int().min(-999999999999).max(999999999999),
        allocations: z
          .array(
            z.object({
              user_id: z.string().uuid(),
              value: z.number().int().positive().max(999999999999),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .min(1)
    .max(100)
    .optional(),
});
