-- Submittals — add attachments column.
--
-- SubmittalDetailPage uploads files to storage and writes an array of
-- { path, name, size, type, uploaded_at } records to submittals.attachments,
-- but the column never existed. Uploads silently "succeeded" (storage write
-- worked, DB update stripped the field via sanitizer) and no document ever
-- appeared in the viewer.

ALTER TABLE submittals ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
