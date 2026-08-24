---
name: Tatum webhook integration
description: Tatum V4 address monitoring, HMAC verification, and finality requirements
---

Use Tatum V4 `ADDRESS_EVENT` subscriptions with explicit chain names; for EVM and TRON, request `finality: "final"` so balance credits are not based only on transaction detection. Verify `x-payload-hash` against the exact raw request bytes with HMAC-SHA512 Base64.

**Why:** Tatum's notification API separates address monitoring from finality, and parsing/re-serializing JSON can change the signed bytes.

**How to apply:** Keep provider credentials server-side, resolve ownership from the saved address, and put duplicate detection plus balance/history writes in one database transaction.