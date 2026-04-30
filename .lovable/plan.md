I found the immediate cause: the app sends password reset links back to `/admin/auth`, but the admin login page only listens for normal login/reset-request actions. It does not reliably render the “set new password” form after the recovery link signs you in, so you land on the login screen instead.

I also verified your admin record still exists: `pnderitu2@gmail.com` is active and still has the `admin` role. The backend security linter currently reports no issues.

Plan to fix this safely:

1. Add a dedicated password reset route
   - Create a public `/reset-password` page whose only job is to handle recovery links and let the user enter a new password.
   - It will validate that a recovery session exists before showing the form.
   - After a successful password update, it will check the user’s role and redirect admins/finance/pastors to `/admin/dashboard`, otherwise to the member dashboard.

2. Update all forgot-password links to use the dedicated reset page
   - Admin login reset email: redirect to `/reset-password?portal=admin`.
   - Member login reset email: redirect to `/reset-password?portal=member`.
   - Settings password reset: redirect to `/reset-password`.
   - This avoids relying on the login pages to double as password update pages.

3. Harden the existing auth pages
   - Remove or bypass the fragile inline recovery UI from `AdminAuth`, `Auth`, and `MemberAuth` once the dedicated reset page exists.
   - Keep the “Forgot password?” request flow working from admin and member login.
   - If someone lands on a login page with a recovery callback, forward them to `/reset-password` instead of showing a normal login form.

4. Improve admin role loading resilience
   - Make role checks handle multiple roles consistently, using the highest-privilege role rather than whichever row is returned first.
   - This avoids access bugs for users with more than one role.

5. Verify access recovery and restricted funds were not regressed
   - Run the test suite, including the restricted funds tests.
   - Re-run the backend security linter.
   - Inspect auth logs after a reset attempt if needed.
   - Confirm the reset page, admin login, and admin route access behave as expected.

Important note: I can fix the reset flow, but I should not set or reveal your password. Once the route is fixed, request a fresh reset email and set a new password yourself. Your admin role is still present, so after the new password is saved you should regain access to the admin portal.