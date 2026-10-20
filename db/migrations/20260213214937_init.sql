-- migrate:up

-- uuidv7() is built into PostgreSQL 18+; provide it for PostgreSQL 16/17 (VPS).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION public.uuidv7() RETURNS uuid AS $$
DECLARE
  ts_ms bigint;
  bytes bytea;
BEGIN
  ts_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  bytes := gen_random_bytes(16);
  bytes := set_byte(bytes, 0, ((ts_ms >> 40) & 255)::integer);
  bytes := set_byte(bytes, 1, ((ts_ms >> 32) & 255)::integer);
  bytes := set_byte(bytes, 2, ((ts_ms >> 24) & 255)::integer);
  bytes := set_byte(bytes, 3, ((ts_ms >> 16) & 255)::integer);
  bytes := set_byte(bytes, 4, ((ts_ms >> 8) & 255)::integer);
  bytes := set_byte(bytes, 5, (ts_ms & 255)::integer);
  bytes := set_byte(bytes, 6, (get_byte(bytes, 6) & 15) | 112);
  bytes := set_byte(bytes, 8, (get_byte(bytes, 8) & 63) | 128);
  RETURN encode(bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TABLE users (
  id uuid not null default uuidv7() constraint pk_users_id primary key,
  name varchar(255) not null,
  email varchar(255) not null constraint uk_users_email unique,
  password_hash text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create table files (
  id uuid not null default uuidv7() constraint pk_files_id primary key,
  key text not null constraint uk_files_key unique,
  endpoint text not null default 'http://localhost:3007/files',
  url text generated always as (endpoint || '/' || key) stored,
  _status varchar(100) not null default 'pending',
  created_at timestamp with time zone not null default now()
);

-- migrate:down

drop table files;
drop table users;
