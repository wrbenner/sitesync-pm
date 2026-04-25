-- Raise the file size limit on project-files bucket to 500 MB
-- Construction drawings (PDFs, DWGs) routinely exceed 50 MB.
-- This allows resumable (TUS) uploads up to 500 MB per object.
UPDATE storage.buckets
SET file_size_limit = 524288000   -- 500 MB in bytes
WHERE id = 'project-files';
