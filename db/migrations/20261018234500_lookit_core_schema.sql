-- migrate:up

-- ---------------------------------------------------------------------------
-- Extend users (boilerplate) for Lookit roles / studio profile
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS studio_name varchar(255),
  ADD COLUMN IF NOT EXISTS logo_key text,
  ADD COLUMN IF NOT EXISTS role varchar(32) NOT NULL DEFAULT 'photographer',
  ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS ck_users_role,
  DROP CONSTRAINT IF EXISTS ck_users_status;

ALTER TABLE users
  ADD CONSTRAINT ck_users_role CHECK (role IN ('photographer', 'admin')),
  ADD CONSTRAINT ck_users_status CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
-- Plans (data-driven; admin-editable)
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_plans_id PRIMARY KEY,
  code varchar(64) NOT NULL CONSTRAINT uk_plans_code UNIQUE,
  name varchar(255) NOT NULL,
  kind varchar(32) NOT NULL,
  price_inr integer NOT NULL,
  photo_quota integer NOT NULL,
  duration_days integer NOT NULL,
  retention_days integer NOT NULL DEFAULT 90,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_plans_kind CHECK (kind IN ('monthly', 'season', 'topup', 'trial')),
  CONSTRAINT ck_plans_price CHECK (price_inr >= 0),
  CONSTRAINT ck_plans_quota CHECK (photo_quota > 0)
);

CREATE INDEX idx_plans_active_sort ON plans (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Payment orders (manual UPI)
-- ---------------------------------------------------------------------------
CREATE TABLE payment_orders (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_payment_orders_id PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind varchar(32) NOT NULL,
  plan_id uuid REFERENCES plans (id),
  amount_inr integer NOT NULL,
  ref_code varchar(32) NOT NULL CONSTRAINT uk_payment_orders_ref_code UNIQUE,
  utr varchar(128) CONSTRAINT uk_payment_orders_utr UNIQUE,
  screenshot_key text,
  status varchar(32) NOT NULL DEFAULT 'pending_payment',
  reject_reason text,
  reviewed_by uuid REFERENCES users (id),
  reviewed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_payment_orders_kind CHECK (kind IN ('plan', 'topup', 'upgrade', 'season', 'trial')),
  CONSTRAINT ck_payment_orders_status CHECK (
    status IN ('pending_payment', 'submitted', 'approved', 'rejected', 'expired')
  ),
  CONSTRAINT ck_payment_orders_amount CHECK (amount_inr >= 0)
);

CREATE INDEX idx_payment_orders_user ON payment_orders (user_id, created_at DESC);
CREATE INDEX idx_payment_orders_status ON payment_orders (status);

-- ---------------------------------------------------------------------------
-- Plan purchases / quota buckets
-- ---------------------------------------------------------------------------
CREATE TABLE plan_purchases (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_plan_purchases_id PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  plan_id uuid NOT NULL REFERENCES plans (id),
  source_order_id uuid REFERENCES payment_orders (id),
  photo_quota integer NOT NULL,
  photos_used integer NOT NULL DEFAULT 0,
  photos_reserved integer NOT NULL DEFAULT 0,
  upload_window_end timestamptz NOT NULL,
  retention_end timestamptz NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_plan_purchases_status CHECK (
    status IN ('active', 'exhausted', 'expired', 'revoked')
  ),
  CONSTRAINT ck_plan_purchases_quota CHECK (photo_quota > 0),
  CONSTRAINT ck_plan_purchases_used CHECK (photos_used >= 0),
  CONSTRAINT ck_plan_purchases_reserved CHECK (photos_reserved >= 0),
  CONSTRAINT ck_plan_purchases_counts CHECK (photos_used + photos_reserved <= photo_quota)
);

CREATE INDEX idx_plan_purchases_user_status ON plan_purchases (user_id, status);
CREATE INDEX idx_plan_purchases_windows ON plan_purchases (upload_window_end, retention_end);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_events_id PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users (id),
  slug varchar(128) NOT NULL CONSTRAINT uk_events_slug UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  event_date date,
  visibility varchar(32) NOT NULL DEFAULT 'selfie_only',
  pin_hash text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_desktop_key text,
  cover_mobile_key text,
  face_collection_id text,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_events_visibility CHECK (visibility IN ('selfie_only', 'full_gallery')),
  CONSTRAINT ck_events_status CHECK (status IN ('active', 'hidden', 'deleted'))
);

CREATE INDEX idx_events_owner ON events (owner_id, created_at DESC);
CREATE INDEX idx_events_status ON events (status);

-- ---------------------------------------------------------------------------
-- Upload sessions (atomic quota reservation)
-- ---------------------------------------------------------------------------
CREATE TABLE upload_sessions (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_upload_sessions_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id),
  purchase_id uuid NOT NULL REFERENCES plan_purchases (id),
  user_id uuid NOT NULL REFERENCES users (id),
  reserved_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_upload_sessions_status CHECK (
    status IN ('open', 'completed', 'aborted', 'expired')
  ),
  CONSTRAINT ck_upload_sessions_counts CHECK (
    reserved_count >= 0 AND completed_count >= 0 AND completed_count <= reserved_count
  )
);

CREATE INDEX idx_upload_sessions_expires ON upload_sessions (expires_at)
  WHERE status = 'open';
CREATE INDEX idx_upload_sessions_event ON upload_sessions (event_id);

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------
CREATE TABLE photos (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_photos_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES plan_purchases (id),
  upload_session_id uuid REFERENCES upload_sessions (id),
  orig_key text,
  prev_key text,
  thumb_key text,
  content_hash text,
  width integer,
  height integer,
  size_bytes bigint,
  taken_at timestamptz,
  status varchar(32) NOT NULL DEFAULT 'uploading',
  error text,
  faces_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ck_photos_status CHECK (
    status IN (
      'uploading',
      'uploaded',
      'processing',
      'processed',
      'indexed',
      'failed'
    )
  )
);

CREATE UNIQUE INDEX uk_photos_event_content_hash
  ON photos (event_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX idx_photos_event_status ON photos (event_id, status);
CREATE INDEX idx_photos_event_taken_at ON photos (event_id, taken_at);
CREATE INDEX idx_photos_expires_at ON photos (expires_at);
CREATE INDEX idx_photos_purchase ON photos (purchase_id);

-- ---------------------------------------------------------------------------
-- Faces (Rekognition external ids; embedding column reserved for Phase 3)
-- ---------------------------------------------------------------------------
CREATE TABLE faces (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_faces_id PRIMARY KEY,
  photo_id uuid NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  external_face_id text NOT NULL,
  box jsonb,
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_faces_event_external UNIQUE (event_id, external_face_id)
);

CREATE INDEX idx_faces_photo ON faces (photo_id);
CREATE INDEX idx_faces_event ON faces (event_id);

-- ---------------------------------------------------------------------------
-- Guest consents / share links / analytics
-- ---------------------------------------------------------------------------
CREATE TABLE guest_consents (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_guest_consents_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  consent_version varchar(64) NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_consents_event ON guest_consents (event_id, created_at DESC);

CREATE TABLE share_links (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_share_links_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  token text NOT NULL CONSTRAINT uk_share_links_token UNIQUE,
  photo_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_links_event ON share_links (event_id);

CREATE TABLE analytics_events (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_analytics_events_id PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  type varchar(32) NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_analytics_events_type CHECK (type IN ('view', 'search', 'download'))
);

CREATE INDEX idx_analytics_events_event_type ON analytics_events (event_id, type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Audit + settings + face API usage
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_audit_logs_id PRIMARY KEY,
  actor_id uuid REFERENCES users (id),
  action varchar(128) NOT NULL,
  target_type varchar(64),
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);

CREATE TABLE settings (
  key varchar(128) NOT NULL CONSTRAINT pk_settings_key PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE face_api_usage (
  id uuid NOT NULL DEFAULT uuidv7() CONSTRAINT pk_face_api_usage_id PRIMARY KEY,
  day date NOT NULL,
  event_id uuid REFERENCES events (id) ON DELETE SET NULL,
  calls integer NOT NULL DEFAULT 0,
  estimated_usd numeric(12, 4) NOT NULL DEFAULT 0
);

-- NULLs are distinct in UNIQUE; use partial indexes for global vs per-event caps
CREATE UNIQUE INDEX uk_face_api_usage_day_global
  ON face_api_usage (day)
  WHERE event_id IS NULL;
CREATE UNIQUE INDEX uk_face_api_usage_day_event
  ON face_api_usage (day, event_id)
  WHERE event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed: plans
-- ---------------------------------------------------------------------------
INSERT INTO plans (code, name, kind, price_inr, photo_quota, duration_days, retention_days, entitlements, sort_order)
VALUES
  (
    'base_monthly',
    'Base',
    'monthly',
    1499,
    5000,
    30,
    90,
    '{"white_label": false, "team_logins": 0, "max_events": null, "powered_by_badge": true}'::jsonb,
    10
  ),
  (
    'pro_monthly',
    'Pro',
    'monthly',
    2499,
    9000,
    30,
    90,
    '{"white_label": true, "team_logins": 0, "max_events": null, "powered_by_badge": false}'::jsonb,
    20
  ),
  (
    'studio_monthly',
    'Studio',
    'monthly',
    5999,
    22000,
    30,
    90,
    '{"white_label": true, "team_logins": 3, "max_events": null, "powered_by_badge": false}'::jsonb,
    30
  ),
  (
    'topup_1000',
    'Top-up 1,000 photos',
    'topup',
    299,
    1000,
    30,
    90,
    '{}'::jsonb,
    40
  ),
  (
    'base_season',
    'Base Season Pass (2 months)',
    'season',
    2699,
    10000,
    60,
    90,
    '{"white_label": false, "team_logins": 0, "powered_by_badge": true}'::jsonb,
    50
  ),
  (
    'pro_season',
    'Pro Season Pass (2 months)',
    'season',
    4499,
    18000,
    60,
    90,
    '{"white_label": true, "team_logins": 0, "powered_by_badge": false}'::jsonb,
    60
  ),
  (
    'studio_season',
    'Studio Season Pass (2 months)',
    'season',
    10799,
    44000,
    60,
    90,
    '{"white_label": true, "team_logins": 3, "powered_by_badge": false}'::jsonb,
    70
  ),
  (
    'trial_7d',
    'Free trial',
    'trial',
    0,
    500,
    7,
    90,
    '{"white_label": false, "team_logins": 0, "max_events": 1, "powered_by_badge": true, "admin_grant_only": true}'::jsonb,
    5
  );

-- ---------------------------------------------------------------------------
-- Seed: settings
-- ---------------------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  (
    'upi',
    '{"upi_id": "", "payee_name": "Lookit Studio", "qr_image_key": null}'::jsonb
  ),
  (
    'face',
    '{"match_threshold": 90, "daily_cap_global": 5000, "daily_cap_per_event": 2000}'::jsonb
  ),
  (
    'consent',
    '{"current_version": "2026-10-18", "text_en": "We use your selfie only to find photos of you in this event. The selfie is processed in memory and never stored. You can delete your data from the results page."}'::jsonb
  ),
  (
    'admin',
    '{"bootstrap_emails": ["yashchauhan1775@gmail.com"]}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- Seed: bootstrap admin (temp password — change after first login)
-- password: LookitAdmin!change-me
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, studio_name, role, status)
VALUES (
  'Yash Chauhan',
  'yashchauhan1775@gmail.com',
  '$2b$10$1VHrBItqXbpUTLJIowcLVux013JPJQ6jpYRRiZ8aFSo6EWaJO4Hsy',
  'Lookit',
  'admin',
  'active'
)
ON CONFLICT (email) DO UPDATE
SET
  role = 'admin',
  status = 'active',
  updated_at = now();

INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
SELECT
  u.id,
  'admin.bootstrap',
  'user',
  u.id,
  '{"note": "Seeded/promoted admin from migration", "email": "yashchauhan1775@gmail.com"}'::jsonb
FROM users u
WHERE u.email = 'yashchauhan1775@gmail.com';

-- migrate:down

DROP TABLE IF EXISTS face_api_usage;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS share_links;
DROP TABLE IF EXISTS guest_consents;
DROP TABLE IF EXISTS faces;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS upload_sessions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS plan_purchases;
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS plans;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS ck_users_role,
  DROP CONSTRAINT IF EXISTS ck_users_status;

DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_status;

ALTER TABLE users
  DROP COLUMN IF EXISTS studio_name,
  DROP COLUMN IF EXISTS logo_key,
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS status;
