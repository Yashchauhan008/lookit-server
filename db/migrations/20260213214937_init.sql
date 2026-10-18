-- migrate:up

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
