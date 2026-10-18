\restrict dbmate

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    type character varying(32) NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_analytics_events_type CHECK (((type)::text = ANY ((ARRAY['view'::character varying, 'search'::character varying, 'download'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    actor_id uuid,
    action character varying(128) NOT NULL,
    target_type character varying(64),
    target_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    slug character varying(128) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    event_date date,
    visibility character varying(32) DEFAULT 'selfie_only'::character varying NOT NULL,
    pin_hash text,
    theme jsonb DEFAULT '{}'::jsonb NOT NULL,
    cover_desktop_key text,
    cover_mobile_key text,
    face_collection_id text,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_events_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'hidden'::character varying, 'deleted'::character varying])::text[]))),
    CONSTRAINT ck_events_visibility CHECK (((visibility)::text = ANY ((ARRAY['selfie_only'::character varying, 'full_gallery'::character varying])::text[])))
);


--
-- Name: face_api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.face_api_usage (
    id uuid DEFAULT uuidv7() NOT NULL,
    day date NOT NULL,
    event_id uuid,
    calls integer DEFAULT 0 NOT NULL,
    estimated_usd numeric(12,4) DEFAULT 0 NOT NULL
);


--
-- Name: faces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faces (
    id uuid DEFAULT uuidv7() NOT NULL,
    photo_id uuid NOT NULL,
    event_id uuid NOT NULL,
    external_face_id text NOT NULL,
    box jsonb,
    confidence real,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT uuidv7() NOT NULL,
    key text NOT NULL,
    endpoint text DEFAULT 'http://localhost:3007/files'::text NOT NULL,
    url text GENERATED ALWAYS AS (((endpoint || '/'::text) || key)) STORED,
    _status character varying(100) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: guest_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_consents (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    consent_version character varying(64) NOT NULL,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(32) NOT NULL,
    plan_id uuid,
    amount_inr integer NOT NULL,
    ref_code character varying(32) NOT NULL,
    utr character varying(128),
    screenshot_key text,
    status character varying(32) DEFAULT 'pending_payment'::character varying NOT NULL,
    reject_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_payment_orders_amount CHECK ((amount_inr >= 0)),
    CONSTRAINT ck_payment_orders_kind CHECK (((kind)::text = ANY ((ARRAY['plan'::character varying, 'topup'::character varying, 'upgrade'::character varying, 'season'::character varying, 'trial'::character varying])::text[]))),
    CONSTRAINT ck_payment_orders_status CHECK (((status)::text = ANY ((ARRAY['pending_payment'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photos (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    upload_session_id uuid,
    orig_key text,
    prev_key text,
    thumb_key text,
    content_hash text,
    width integer,
    height integer,
    size_bytes bigint,
    taken_at timestamp with time zone,
    status character varying(32) DEFAULT 'uploading'::character varying NOT NULL,
    error text,
    faces_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_photos_status CHECK (((status)::text = ANY ((ARRAY['uploading'::character varying, 'uploaded'::character varying, 'processing'::character varying, 'processed'::character varying, 'indexed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: plan_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_purchases (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    source_order_id uuid,
    photo_quota integer NOT NULL,
    photos_used integer DEFAULT 0 NOT NULL,
    photos_reserved integer DEFAULT 0 NOT NULL,
    upload_window_end timestamp with time zone NOT NULL,
    retention_end timestamp with time zone NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_plan_purchases_counts CHECK (((photos_used + photos_reserved) <= photo_quota)),
    CONSTRAINT ck_plan_purchases_quota CHECK ((photo_quota > 0)),
    CONSTRAINT ck_plan_purchases_reserved CHECK ((photos_reserved >= 0)),
    CONSTRAINT ck_plan_purchases_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'exhausted'::character varying, 'expired'::character varying, 'revoked'::character varying])::text[]))),
    CONSTRAINT ck_plan_purchases_used CHECK ((photos_used >= 0))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    kind character varying(32) NOT NULL,
    price_inr integer NOT NULL,
    photo_quota integer NOT NULL,
    duration_days integer NOT NULL,
    retention_days integer DEFAULT 90 NOT NULL,
    entitlements jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_plans_kind CHECK (((kind)::text = ANY ((ARRAY['monthly'::character varying, 'season'::character varying, 'topup'::character varying, 'trial'::character varying])::text[]))),
    CONSTRAINT ck_plans_price CHECK ((price_inr >= 0)),
    CONSTRAINT ck_plans_quota CHECK ((photo_quota > 0))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(128) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    token text NOT NULL,
    photo_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: upload_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_sessions (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reserved_count integer DEFAULT 0 NOT NULL,
    completed_count integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'open'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT ck_upload_sessions_counts CHECK (((reserved_count >= 0) AND (completed_count >= 0) AND (completed_count <= reserved_count))),
    CONSTRAINT ck_upload_sessions_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'completed'::character varying, 'aborted'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    studio_name character varying(255),
    logo_key text,
    role character varying(32) DEFAULT 'photographer'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['photographer'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT ck_users_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: analytics_events pk_analytics_events_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT pk_analytics_events_id PRIMARY KEY (id);


--
-- Name: audit_logs pk_audit_logs_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT pk_audit_logs_id PRIMARY KEY (id);


--
-- Name: events pk_events_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT pk_events_id PRIMARY KEY (id);


--
-- Name: face_api_usage pk_face_api_usage_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.face_api_usage
    ADD CONSTRAINT pk_face_api_usage_id PRIMARY KEY (id);


--
-- Name: faces pk_faces_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faces
    ADD CONSTRAINT pk_faces_id PRIMARY KEY (id);


--
-- Name: files pk_files_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT pk_files_id PRIMARY KEY (id);


--
-- Name: guest_consents pk_guest_consents_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_consents
    ADD CONSTRAINT pk_guest_consents_id PRIMARY KEY (id);


--
-- Name: payment_orders pk_payment_orders_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT pk_payment_orders_id PRIMARY KEY (id);


--
-- Name: photos pk_photos_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT pk_photos_id PRIMARY KEY (id);


--
-- Name: plan_purchases pk_plan_purchases_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_purchases
    ADD CONSTRAINT pk_plan_purchases_id PRIMARY KEY (id);


--
-- Name: plans pk_plans_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT pk_plans_id PRIMARY KEY (id);


--
-- Name: settings pk_settings_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT pk_settings_key PRIMARY KEY (key);


--
-- Name: share_links pk_share_links_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT pk_share_links_id PRIMARY KEY (id);


--
-- Name: upload_sessions pk_upload_sessions_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT pk_upload_sessions_id PRIMARY KEY (id);


--
-- Name: users pk_users_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users_id PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: events uk_events_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT uk_events_slug UNIQUE (slug);


--
-- Name: faces uk_faces_event_external; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faces
    ADD CONSTRAINT uk_faces_event_external UNIQUE (event_id, external_face_id);


--
-- Name: files uk_files_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT uk_files_key UNIQUE (key);


--
-- Name: payment_orders uk_payment_orders_ref_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT uk_payment_orders_ref_code UNIQUE (ref_code);


--
-- Name: payment_orders uk_payment_orders_utr; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT uk_payment_orders_utr UNIQUE (utr);


--
-- Name: plans uk_plans_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT uk_plans_code UNIQUE (code);


--
-- Name: share_links uk_share_links_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT uk_share_links_token UNIQUE (token);


--
-- Name: users uk_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_users_email UNIQUE (email);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_id, type, created_at DESC);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_events_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_owner ON public.events USING btree (owner_id, created_at DESC);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_status ON public.events USING btree (status);


--
-- Name: idx_faces_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faces_event ON public.faces USING btree (event_id);


--
-- Name: idx_faces_photo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faces_photo ON public.faces USING btree (photo_id);


--
-- Name: idx_guest_consents_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_consents_event ON public.guest_consents USING btree (event_id, created_at DESC);


--
-- Name: idx_payment_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_status ON public.payment_orders USING btree (status);


--
-- Name: idx_payment_orders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_user ON public.payment_orders USING btree (user_id, created_at DESC);


--
-- Name: idx_photos_event_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photos_event_status ON public.photos USING btree (event_id, status);


--
-- Name: idx_photos_event_taken_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photos_event_taken_at ON public.photos USING btree (event_id, taken_at);


--
-- Name: idx_photos_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photos_expires_at ON public.photos USING btree (expires_at);


--
-- Name: idx_photos_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photos_purchase ON public.photos USING btree (purchase_id);


--
-- Name: idx_plan_purchases_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_purchases_user_status ON public.plan_purchases USING btree (user_id, status);


--
-- Name: idx_plan_purchases_windows; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_purchases_windows ON public.plan_purchases USING btree (upload_window_end, retention_end);


--
-- Name: idx_plans_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_active_sort ON public.plans USING btree (is_active, sort_order);


--
-- Name: idx_share_links_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_links_event ON public.share_links USING btree (event_id);


--
-- Name: idx_upload_sessions_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_event ON public.upload_sessions USING btree (event_id);


--
-- Name: idx_upload_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_expires ON public.upload_sessions USING btree (expires_at) WHERE ((status)::text = 'open'::text);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: uk_face_api_usage_day_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_face_api_usage_day_event ON public.face_api_usage USING btree (day, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: uk_face_api_usage_day_global; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_face_api_usage_day_global ON public.face_api_usage USING btree (day) WHERE (event_id IS NULL);


--
-- Name: uk_photos_event_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_photos_event_content_hash ON public.photos USING btree (event_id, content_hash) WHERE (content_hash IS NOT NULL);


--
-- Name: analytics_events analytics_events_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: events events_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: face_api_usage face_api_usage_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.face_api_usage
    ADD CONSTRAINT face_api_usage_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: faces faces_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faces
    ADD CONSTRAINT faces_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: faces faces_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faces
    ADD CONSTRAINT faces_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- Name: guest_consents guest_consents_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_consents
    ADD CONSTRAINT guest_consents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: payment_orders payment_orders_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: payment_orders payment_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: photos photos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: photos photos_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.plan_purchases(id);


--
-- Name: photos photos_upload_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_upload_session_id_fkey FOREIGN KEY (upload_session_id) REFERENCES public.upload_sessions(id);


--
-- Name: plan_purchases plan_purchases_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_purchases
    ADD CONSTRAINT plan_purchases_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: plan_purchases plan_purchases_source_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_purchases
    ADD CONSTRAINT plan_purchases_source_order_id_fkey FOREIGN KEY (source_order_id) REFERENCES public.payment_orders(id);


--
-- Name: plan_purchases plan_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_purchases
    ADD CONSTRAINT plan_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: share_links share_links_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: upload_sessions upload_sessions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: upload_sessions upload_sessions_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.plan_purchases(id);


--
-- Name: upload_sessions upload_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260213214937'),
    ('20261018234500');
