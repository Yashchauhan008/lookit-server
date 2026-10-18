-- migrate:up

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS multipart_upload_id text,
  ADD COLUMN IF NOT EXISTS content_type varchar(128),
  ADD COLUMN IF NOT EXISTS original_filename text;

-- migrate:down

ALTER TABLE photos
  DROP COLUMN IF EXISTS multipart_upload_id,
  DROP COLUMN IF EXISTS content_type,
  DROP COLUMN IF EXISTS original_filename;
