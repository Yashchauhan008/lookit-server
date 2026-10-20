-- migrate:up

-- One row per guest face scan: the saved selfie, which photos matched, and how much it cost.
CREATE TABLE guest_scans (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_guest_scans_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  selfie_key text,
  matched_photo_ids uuid[] NOT NULL DEFAULT '{}',
  match_count integer NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL,
  rekognition_calls integer NOT NULL DEFAULT 1,
  consent_version varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ck_guest_scans_status CHECK (status IN ('matched', 'no_match', 'no_face')),
  CONSTRAINT ck_guest_scans_count CHECK (match_count >= 0)
);

CREATE INDEX idx_guest_scans_event ON guest_scans (event_id, created_at DESC);
CREATE INDEX idx_guest_scans_guest ON guest_scans (event_id, guest_id, created_at DESC);

-- A guest re-opening their saved results counts as a Rekognition call we did not have to make.
ALTER TABLE analytics_events DROP CONSTRAINT ck_analytics_events_type;
ALTER TABLE analytics_events
  ADD CONSTRAINT ck_analytics_events_type CHECK (type IN ('view', 'search', 'download', 'cache_hit'));

-- Selfies are now saved and visible to the event owner, so the consent text says so (new version = re-consent).
UPDATE settings
SET value = jsonb_set(
      jsonb_set(value, '{current_version}', '"2026-10-21"'),
      '{text_en}',
      to_jsonb('We use your selfie to find photos of you in this event. Your selfie is saved with this event and can be seen by the event''s photographer, together with which photos matched you. You can delete your selfie and results at any time from your results page.'::text)
    ),
    updated_at = now()
WHERE key = 'consent';

-- migrate:down

UPDATE settings
SET value = jsonb_set(
      jsonb_set(value, '{current_version}', '"2026-10-18"'),
      '{text_en}',
      to_jsonb('We use your selfie only to find photos of you in this event. The selfie is processed in memory and never stored. You can delete your data from the results page.'::text)
    ),
    updated_at = now()
WHERE key = 'consent';

ALTER TABLE analytics_events DROP CONSTRAINT ck_analytics_events_type;
ALTER TABLE analytics_events
  ADD CONSTRAINT ck_analytics_events_type CHECK (type IN ('view', 'search', 'download'));

DROP TABLE IF EXISTS guest_scans;
