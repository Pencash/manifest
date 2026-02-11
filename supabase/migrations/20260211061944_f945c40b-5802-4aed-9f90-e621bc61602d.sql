
-- Add length constraints to text fields
ALTER TABLE prayer_requests ADD CONSTRAINT body_length_check CHECK (length(body) <= 5000);
ALTER TABLE prayer_requests ADD CONSTRAINT title_length_check CHECK (title IS NULL OR length(title) <= 200);
ALTER TABLE testimonies ADD CONSTRAINT body_length_check CHECK (length(body) <= 5000);
ALTER TABLE testimonies ADD CONSTRAINT title_length_check CHECK (title IS NULL OR length(title) <= 200);
ALTER TABLE expense_requests ADD CONSTRAINT description_length_check CHECK (length(description) <= 2000);
ALTER TABLE expense_requests ADD CONSTRAINT justification_length_check CHECK (length(justification) <= 2000);
