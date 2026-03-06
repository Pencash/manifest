# Code Review: Improvement Opportunities

This review highlights high-impact opportunities to improve maintainability, correctness, performance, and delivery confidence.

## 1) Fix hook dependency warnings (correctness + stale data risk)

`npm run lint` reports many `react-hooks/exhaustive-deps` warnings. Several pages/components call async loaders in `useEffect` without stable callback dependencies, which can produce stale closures and hard-to-reproduce state bugs.

**Suggested actions**
- Convert effect-triggered functions (`checkAuth`, `checkUser`, `loadMetrics`, etc.) to `useCallback` and include them in effect dependencies.
- Extract common authenticated page bootstrap logic into a reusable hook (`useRequireRole`) to reduce repeated effect patterns.
- Turn on CI lint gating so warnings are not silently ignored over time.

## 2) Reduce page/component size through feature-level decomposition

Many page files are very large (roughly 500–1000+ LOC), mixing data access, authorization, transformations, and rendering in one place.

**Suggested actions**
- Split pages into `containers` + presentational components.
- Move aggregation/transformation logic (chart transforms, summaries, timeline formatting) into pure utility modules with unit tests.
- Create feature folders for heavy domains (`givings`, `attendance`, `mobilization`, `expenses`) to improve ownership and navigation.

## 3) Centralize authorization and session guard logic

Auth checks are repeated in many pages with similar patterns and hand-rolled redirect behavior.

**Suggested actions**
- Introduce route guards (e.g., `ProtectedRoute`, `RoleRoute`) to enforce access in one place.
- Build role-aware wrappers around layouts/routes instead of page-level duplicated checks.
- Reuse `AuthContext` role/profile state as primary source for guards and remove repeated ad-hoc session fetches.

## 4) Standardize data fetching and caching via React Query

The app already initializes React Query globally, but many pages still run imperative `useEffect + useState` data loading patterns.

**Suggested actions**
- Move Supabase reads into query hooks (`useAdminMetricsQuery`, `useGivingsQuery`, etc.).
- Use query keys and invalidation for consistent refresh behavior.
- Replace manual `loading/error` state with query states to reduce boilerplate and race conditions.

## 5) Security hardening for edge functions

Edge functions currently allow wildcard CORS origins and rely on role checks embedded in each function.

**Suggested actions**
- Restrict `Access-Control-Allow-Origin` to expected domain(s) per environment.
- Add shared auth/role validation helper for edge functions to avoid drift.
- Add rate limiting and request schema validation at function boundary to reduce abuse risk.

## 6) Add automated test coverage and CI quality gates

The project has lint/build scripts but no test script configured.

**Suggested actions**
- Add unit tests for critical data transforms and auth guard logic.
- Add integration tests for high-risk flows (admin auth, giving verification, attendance import).
- Require lint + tests + build in CI before merges.

## 7) Improve project documentation for contributors

README is still a generic template and does not document this project's domain, architecture, or runbook.

**Suggested actions**
- Replace template sections with real setup instructions (env vars, Supabase local/remote setup, migrations workflow).
- Add architecture overview (routing, auth model, edge functions, data ownership boundaries).
- Add troubleshooting/operations notes (common failures, deploy rollback, migration safety checklist).
