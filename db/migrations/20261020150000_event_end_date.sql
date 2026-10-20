-- migrate:up

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD CONSTRAINT ck_events_dates CHECK (end_date IS NULL OR event_date IS NULL OR end_date >= event_date);

-- migrate:down

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS ck_events_dates,
  DROP COLUMN IF EXISTS end_date;
