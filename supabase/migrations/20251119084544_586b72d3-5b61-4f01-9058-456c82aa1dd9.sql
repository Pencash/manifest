-- Update visitor_followups RLS policy to include finance role
DROP POLICY IF EXISTS "Pastoral team can manage followups" ON visitor_followups;

CREATE POLICY "Pastoral team and finance can manage followups" 
ON visitor_followups
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pastor'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
);