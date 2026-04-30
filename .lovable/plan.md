I found the likely root cause: your database role is correctly configured as `admin`, and the records still exist. The breakage is coming from the recent security hardening: execution access to the backend role helper (`has_role`) was revoked too broadly. Many RLS policies depend on that helper, so authenticated reads like profiles, givings, services, attendance, and admin-only pages can silently return no records or fail permission checks. Some frontend pages also still perform direct role reads and choose the first returned role instead of using the secure backend role resolver, which can misclassify users who have multiple roles.

What I will fix:

1. Repair backend role-helper permissions
   - Add a migration to grant the minimum required execution permissions on safe role-check helper functions used by RLS (`has_role`, `get_user_role`) to authenticated users.
   - Keep sensitive functions like login-attempt logging locked down unless they are only called by secure backend functions.
   - Re-run the backend security linter after the migration.

2. Standardize role resolution across admin pages
   - Replace remaining direct frontend `user_roles` checks with the existing secure `fetchCurrentUserAccess()` helper.
   - Use `getHighestRole()` everywhere roles are evaluated so `admin` wins over `pastor`, `finance`, and `member`.
   - Fix pages that currently use `.single()` or `rolesData[0]`, because that can incorrectly interpret an admin as another role.

3. Fix the dashboard-specific duplicate auth check
   - `AdminDashboard` is already behind `RoleRoute`, but it still performs a second direct role/profile check that can fail independently and show “Failed to load admin profile.”
   - Refactor it to use `useAuth()`/secure access data instead of querying `profiles` and `user_roles` directly.

4. Review related privilege flows
   - Check the admin pages that showed similar direct role checks: givings, attendance, events, reports, expense approvals, mobilization, visitor follow-up, and user management.
   - Keep actual data access protected by RLS; the frontend change is only to prevent false “access denied” decisions.

5. Verify after implementation
   - Confirm your account `pnderitu2@gmail.com` remains active and has `admin`.
   - Confirm core record counts are visible again: profiles, givings, services, attendance, expense requests.
   - Run the backend security linter and note any remaining unrelated warnings separately.
   - Run the app tests available in the project.
   - Test admin dashboard access and at least one secondary admin route for role recognition.

Expected result:
- You should remain logged in as admin.
- The admin dashboard should show the existing database records again instead of all zeros.
- The “access denied, admin privileges required” toast should stop appearing for your admin account.
- Other users’ privileges should be interpreted consistently according to role priority: admin > pastor > finance > member.