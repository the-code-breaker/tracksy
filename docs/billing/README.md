# Group billing: restricted initial model

Apple allows one active subscription within a store subscription group. Tracksy groups are user-created financial groups, so dynamically treating each as an App Store subscription group is not a reliable product design. See [Apple's subscription documentation](https://developer.apple.com/app-store/subscriptions/).

The initial implementation therefore supports **one immutable beneficiary Tracksy group per purchasing Tracksy account**, across mobile providers. Other members can fund their own groups. A purchaser can belong to any number of premium groups funded by other members. Multiple simultaneous premium groups per purchaser, reassignment, family sharing and automatic RevenueCat account transfers are blocked rather than inferred. A vetted seat/slot bundle design could replace this restriction in a future migration after store review and sandbox testing.

## Set up

1. Create reviewed monthly/yearly products and a single App Store subscription group; configure Play base plans according to current provider requirements. Configure RevenueCat offerings and its restore behavior to preserve the original App User ID's purchase ownership. Disable automatic cross-account transfers.
2. Configure the product allowlist in the Edge-function environment. `begin_group_purchase` currently recognizes `tracksy_group_monthly` and `tracksy_group_yearly`; adjust its server allowlist and schema migration for the exact reviewed storefront identifiers. Google Play IDs may include a `:base_plan` suffix; do not enable checkout until product, intent and subscriber lookup identifiers have been tested together.
3. Native RevenueCat public SDK keys go in the mobile public environment. Secret API keys and webhook authorization go only in Supabase Edge secrets. Set `BILLING_ENVIRONMENT=SANDBOX` for tests and change to `PRODUCTION` only after acceptance.
4. Deploy the webhook with platform JWT verification disabled, because RevenueCat does not send a Supabase JWT. Its configured authorization header is still mandatory and compared by fixed-length hash. It re-fetches the subscriber over authenticated TLS before writing any entitlement.
5. On-device purchase flow: select group → server-authorized billing intent → native purchase → verified webhook → immutable mapping → group entitlement. SDK purchase completion alone leaves the group unchanged.

## Rules and caveats

- Active members, not just purchasers, receive feature access for that one group. The backend rejects `has_group_feature` queries for another user identity.
- Cancellation stops renewal while access remains until verified expiration. Grace access ends at the provider-confirmed grace boundary. Refund/revocation blocks premium. Existing records and core operations are preserved.
- A payer leaving, owner transfer or group archive does not transfer or silently cancel the billing contract. The payer retains their billing record; cancellation occurs through the original store. Billing-manager privilege does not grant access to the purchaser's store account.
- Intent creation blocks duplicate activation for an already subscribed group. Unique provider/transaction and purchaser constraints reject replay or arbitrary reassignment. Events are deduplicated and older timestamps cannot overwrite newer processed state.
- Webhook types unsupported by this initial model are acknowledged without granting access. Account-transfer reconciliation needs an operator workflow. New transaction chains after an expiration, plan changes, store-account changes and late initial events require additional acceptance tests and may fail closed under the one-slot constraint.
- Subscriber API snapshots can aggregate plan variants, so exact store transaction ownership and original mappings must be validated in sandbox. The initial webhook checks exact transaction match for initial purchase. Scheduled reconciliation, webhook raw-event quarantine, and operational repair tools remain incomplete.
- Restoration never selects a new beneficiary. Its original mapping stays in place. An unmapped restored purchase is not granted to an arbitrary new group.
- Prices are read from RevenueCat/store products. No planning price is authoritative. No Stripe or web workaround is offered for mobile billing.

The RevenueCat field formats and subscriber state are based on its [webhook schema](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields) and [customer info model](https://www.revenuecat.com/docs/api-v1/customer-info-model). Store sandbox tests have **not** been run.
