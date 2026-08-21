---
name: Tatum deposit wallets
description: Security and persistence rules for external crypto receive addresses
---

Generate deposit wallets only from the backend with the Tatum credential kept in server secrets. Store the resulting address in Supabase with a unique user/asset constraint so repeat requests return the same address.

**Why:** A browser-generated or client-cached address cannot safely protect provider credentials or guarantee a stable deposit destination across devices.

**How to apply:** Authenticate API requests with the Supabase access token, validate the user server-side, and keep network selection explicit (BTC Bitcoin, ETH Ethereum, USDT Tron TRC-20).