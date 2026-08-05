# Vexa Banking App

A full-featured Nigerian digital banking app with personal wallet, business banking, payroll, cashback, and referral features. All user data is stored in Supabase — no demo data, no localStorage for anything user-specific.

## Run & Operate

- `pnpm --filter @workspace/vexa-app run dev` — run the Vexa frontend (port auto-assigned via workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Supabase Setup

**Before users can sign up, run `supabase-schema.sql` in Supabase → SQL Editor.**

Also in Supabase → Authentication → Settings: **disable "Enable email confirmations"** so users can sign up and log in instantly.

Required secrets (already set in Replit Secrets):
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your Supabase anon/public key

The Vite config injects these at build/dev time via `define` in `vite.config.ts`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + TailwindCSS + Wouter (routing)
- Auth & DB: Supabase (Auth + PostgreSQL)
- UI: shadcn/ui components + Radix UI primitives
- Backend: Express 5 (api-server artifact)

## Where Things Live

- `artifacts/vexa-app/src/App.tsx` — all pages/screens (3900+ lines)
- `artifacts/vexa-app/src/context/AuthContext.tsx` — Supabase auth (phone + passcode)
- `artifacts/vexa-app/src/context/UserDataContext.tsx` — balance, cashback, referrals (live from Supabase)
- `artifacts/vexa-app/src/context/BusinessContext.tsx` — business banking data (Supabase)
- `artifacts/vexa-app/src/context/BusinessSecurityContext.tsx` — business PIN (Supabase)
- `artifacts/vexa-app/src/lib/supabase.ts` — Supabase client
- `supabase-schema.sql` — full DB schema to run in Supabase dashboard

## Auth Scheme

Phone-based auth is mapped to Supabase email auth:
- Email stored as `{normalized_phone}@vexa.app`
- Password is the user's 6-digit passcode
- Profile data (name, balance, PIN, referral code, photo) in `profiles` table

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
