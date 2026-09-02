---
name: Tatum webhook integration
description: Tatum V4 address monitoring, HMAC verification, and finality requirements
---

Use Tatum V4 `ADDRESS_EVENT` subscriptions with explicit chain names; for EVM and TRON, request `finality: "final"` so balance credits are not based only on transaction detection. Verify `x-payload-hash` against `JSON.stringify(webhook.event.body)` with HMAC-SHA512 Base64, per Tatum's current documentation.

**Why:** Tatum's notification API separates address monitoring from finality, and its documented HMAC signs the nested event body rather than the outer notification envelope.

**How to apply:** Keep provider credentials server-side, resolve ownership from the saved address, and put duplicate detection plus balance/history writes in one database transaction.

Tatum V4 subscription details may expose the canonical testnet identifier at top-level `chain` while `attr.chain` contains the short asset code; when reusing an alert, match the canonical chain and webhook URL together.

**Why:** Matching only `attr.chain` can make a valid alert look stale, while matching only the chain can silently keep an alert pointed at an old webhook host.

**How to apply:** Before returning a saved subscription ID, verify both `details.chain` and `details.attr.url`; replace the alert only when either differs from the current configuration.