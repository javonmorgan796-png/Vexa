---
name: Tatum webhook integration
description: Tatum V4 address monitoring, HMAC verification, and finality requirements
---

Use Tatum V4 `ADDRESS_EVENT` subscriptions with explicit chain names; for EVM and TRON, request `finality: "final"` so balance credits are not based only on transaction detection. Verify `x-payload-hash` against `JSON.stringify(webhook.event.body)` with HMAC-SHA512 Base64, per Tatum's current documentation.

**Why:** Tatum's notification API separates address monitoring from finality, and its documented HMAC signs the nested event body rather than the outer notification envelope.

**How to apply:** Keep provider credentials server-side, resolve ownership from the saved address, and put duplicate detection plus balance/history writes in one database transaction.