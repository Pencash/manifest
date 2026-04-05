

## Plan: Full User CRUD via Single Edit Dialog + Add User Dialog

### What changes

1. **Add User button** in the page header — opens a creation dialog
2. **Single "Edit" button** per user row replaces the current "Change Password" and "Delete" buttons
3. **Edit dialog** consolidates all user management actions: edit name/email/phone, change role, toggle active status, change password, and delete — all in one clean dialog

### How it works

**Add User flow:**
- "Add User" button with `UserPlus` icon next to the page title
- Dialog with fields: Full Name, Email, Phone (optional), Password, Confirm Password, Role selector
- Submits to a new `admin-create-user` edge function
- On success, list refreshes and toast confirms

**Edit User flow:**
- Each row shows a single "Edit" button (using `Pencil` icon) in the actions column — clean, uncluttered
- Clicking opens a dialog with tabs or sections:
  - **Profile**: Full Name, Email, Phone, Active/Inactive toggle
  - **Security**: New Password + Confirm Password fields
  - **Danger Zone**: Delete user button with confirmation
  - **Role**: Role selector dropdown (reuses existing logic, moved from inline table to dialog)
- Profile changes save directly to the `profiles` table (admin has UPDATE RLS)
- Password changes use the existing `admin-update-user-password` edge function
- Delete uses the existing `admin-delete-user` edge function
- Role changes use the existing `updateUserRole` logic

### Technical details

**New file: `supabase/functions/admin-create-user/index.ts`**
- Reuses `_shared/security.ts` helpers (same pattern as delete/password functions)
- Validates admin role via `has_role` RPC
- Calls `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } })`
- If role is not "member", deletes default role row and inserts the specified one
- Returns `{ success: true, userId }`

**Modified file: `src/pages/UserManagement.tsx`**
- Add `createDialogOpen` state + form fields for new user creation
- Add `editDialogOpen` state + `editTarget` for the selected user
- Replace current row actions (Change Password + Delete buttons) with a single "Edit" button
- Remove the inline "Change Role" `<Select>` column from the table — role editing moves into the edit dialog
- Table columns become: Name, Email, Phone, Role (display badge only), Status, Actions (Edit button)
- Merge existing `passwordDialogOpen` logic into the edit dialog
- Add "Add User" button in the header next to the title
- Client-side validation: required fields, email format, password min 6 chars, passwords match

### Files to create/modify
- **Create**: `supabase/functions/admin-create-user/index.ts`
- **Modify**: `src/pages/UserManagement.tsx`

