-- Add INSERT policy for Admin/Pastor/Finance to create services directly (not just pending)
CREATE POLICY "Admin/Pastor/Finance can create services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pastor'::app_role) OR
  has_role(auth.uid(), 'finance'::app_role)
);

-- Fix foreign key constraints to allow service deletion

-- 1. member_invitations - SET NULL on delete
ALTER TABLE public.member_invitations 
  DROP CONSTRAINT IF EXISTS member_invitations_target_service_id_fkey;
ALTER TABLE public.member_invitations
  ADD CONSTRAINT member_invitations_target_service_id_fkey 
  FOREIGN KEY (target_service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 2. givings - SET NULL on delete
ALTER TABLE public.givings 
  DROP CONSTRAINT IF EXISTS givings_service_id_fkey;
ALTER TABLE public.givings
  ADD CONSTRAINT givings_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 3. testimonies - SET NULL on delete
ALTER TABLE public.testimonies
  DROP CONSTRAINT IF EXISTS testimonies_service_id_fkey;
ALTER TABLE public.testimonies
  ADD CONSTRAINT testimonies_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 4. prayer_requests - SET NULL on delete
ALTER TABLE public.prayer_requests
  DROP CONSTRAINT IF EXISTS prayer_requests_service_id_fkey;
ALTER TABLE public.prayer_requests
  ADD CONSTRAINT prayer_requests_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 5. mobilization_targets - CASCADE delete (targets are meaningless without service)
ALTER TABLE public.mobilization_targets
  DROP CONSTRAINT IF EXISTS mobilization_targets_service_id_fkey;
ALTER TABLE public.mobilization_targets
  ADD CONSTRAINT mobilization_targets_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 6. expense_requests - SET NULL on delete
ALTER TABLE public.expense_requests
  DROP CONSTRAINT IF EXISTS expense_requests_service_id_fkey;
ALTER TABLE public.expense_requests
  ADD CONSTRAINT expense_requests_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 7. event_reminders - CASCADE delete (reminders are meaningless without service)
ALTER TABLE public.event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_service_id_fkey;
ALTER TABLE public.event_reminders
  ADD CONSTRAINT event_reminders_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 8. budgets - SET NULL on delete
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_service_id_fkey;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 9. attendance - CASCADE delete (attendance records belong to service)
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_service_id_fkey;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;