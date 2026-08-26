---
name: Transfer receipts
description: Transfer receipts must reflect the persisted transaction, not a client-only success state
---

Only show a completed transfer receipt after the balance debit and transaction insert both succeed. Use the saved transaction ID as the stable receipt reference, and restore the debit if the transaction cannot be persisted. Historical receipts must load by that ID from the authenticated user's Supabase transaction list, not from transfer-only component state.

**Why:** A client-generated reference or an unchecked insert can show a receipt that does not match transaction history or the user’s actual balance.

**How to apply:** Keep receipt data in the transfer flow until navigation, return the saved transaction from the persistence helper, make history rows navigate to a transaction-ID receipt route, and derive share/print content from the saved record.