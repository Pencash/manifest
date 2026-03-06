# Phaneroo Connect

Phaneroo Connect is a role-based church operations platform for member engagement and admin workflows. It supports offerings/givings, expenses, mobilization, attendance, reminders, and reporting.

## Tech stack

- React + TypeScript + Vite
- Tailwind + shadcn/ui
- Supabase (Auth, Postgres, RLS, Edge Functions)
- TanStack React Query

## Local setup

### 1) Prerequisites
- Node.js 22+
- npm
- Supabase project credentials

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment
Create a `.env` file in the repo root:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

For edge functions, configure secrets in Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (comma-separated production/staging origins)

### 4) Run development server

```bash
npm run dev
```

## Useful commands

```bash
npm run lint      # eslint checks
npm run test      # node:test unit tests
npm run build     # production build
npm run preview   # preview build output
```

## Architecture overview

- `src/App.tsx` defines route tree and applies centralized route guards.
- `src/contexts/AuthContext.tsx` is the main authentication/profile/role source.
- `src/components/routing/*` contains access guards (`ProtectedRoute`, `RoleRoute`).
- `src/hooks/*` contains feature data hooks (including React Query-based fetchers).
- `src/pages/*` contains route-level screens.
- `supabase/migrations/*` contains schema/policy history.
- `supabase/functions/*` contains edge functions and shared security helpers.

## Data & security model (high-level)

- Frontend authenticates users through Supabase Auth.
- Role checks are enforced in UI guards and backend edge functions.
- Database authorization is enforced with Supabase RLS policies.
- Edge functions use Authorization headers + role verification and environment-based CORS restrictions.

## CI quality gates

GitHub Actions runs:
1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`

## Deployment notes

- Apply migrations in order from `supabase/migrations`.
- Deploy edge functions after secrets are set.
- Verify `ALLOWED_ORIGINS` matches deployed frontend domains.
