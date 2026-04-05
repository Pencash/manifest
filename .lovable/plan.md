

## Fix: admin-create-user Edge Function "User not allowed" Error

### Root cause

In `supabase/functions/admin-create-user/index.ts`, the Supabase client is created with `SUPABASE_SERVICE_ROLE_KEY` but the caller's `Authorization` header is passed in `global.headers`. This causes the Auth Admin API to treat the request as a regular user request instead of a service-role request, resulting in `not_admin` / 403.

### Fix

Remove the `global.headers` option from the service-role client creation. The admin check via `has_role` RPC already uses this client with service-role privileges (which is fine — it bypasses RLS). The `auth.admin.createUser()` call then correctly uses the service role key.

```typescript
// BEFORE (broken)
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    global: {
      headers: { Authorization: req.headers.get("Authorization")! },
    },
  },
);

// AFTER (fixed)
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
```

The caller's identity is already verified separately via `getRequestUser(req)` using the anon key + user JWT, so removing the header from the service-role client does not affect the admin check — the `has_role` RPC runs with service-role privileges which can read `user_roles` regardless.

### File to modify
- `supabase/functions/admin-create-user/index.ts` — remove `global.headers` from client creation (lines 23-30)

