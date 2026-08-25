-- Wyth commercial account foundation. Chats, companions, and memories remain local.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birthday date,
  locale text not null default 'zh-CN',
  timezone text not null default 'Asia/Shanghai',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 80),
  constraint profiles_locale_length check (char_length(locale) between 2 and 35),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 80),
  constraint profiles_avatar_path_length check (avatar_path is null or char_length(avatar_path) <= 512)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reduce_motion boolean not null default false,
  native_language text,
  learning_language text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_settings_object check (jsonb_typeof(settings) = 'object'),
  constraint user_preferences_settings_size check (octet_length(settings::text) <= 16384),
  constraint user_preferences_language_length check (
    (native_language is null or char_length(native_language) <= 35)
    and (learning_language is null or char_length(learning_language) <= 35)
  )
);

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null,
  translation text not null,
  source_language text,
  target_language text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_term_length check (char_length(term) between 1 and 500),
  constraint vocabulary_translation_length check (char_length(translation) between 1 and 2000),
  constraint vocabulary_note_length check (note is null or char_length(note) <= 4000)
);

create index vocabulary_items_user_created_idx
  on public.vocabulary_items (user_id, created_at desc);

create unique index vocabulary_items_user_term_unique_idx
  on public.vocabulary_items (user_id, lower(term), coalesce(source_language, ''), coalesce(target_language, ''));

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text not null,
  plan text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider check (provider in ('paddle', 'paypal')),
  constraint subscriptions_plan check (plan in ('standard', 'unlimited')),
  constraint subscriptions_status check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  constraint subscriptions_period_order check (
    current_period_start is null or current_period_end is null or current_period_end > current_period_start
  ),
  constraint subscriptions_provider_id_length check (char_length(provider_subscription_id) between 1 and 255)
);

create unique index subscriptions_provider_subscription_unique_idx
  on public.subscriptions (provider, provider_subscription_id);
create index subscriptions_user_status_idx
  on public.subscriptions (user_id, status, current_period_end desc);

create table public.entitlement_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  credit_usd numeric(10, 4) not null default 0,
  source_type text not null,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint entitlement_periods_kind check (kind in ('trial', 'referral', 'grace', 'support', 'standard', 'unlimited', 'top_up')),
  constraint entitlement_periods_order check (ends_at > starts_at),
  constraint entitlement_periods_credit check (credit_usd >= 0 and credit_usd <= 10000),
  constraint entitlement_periods_source_type_length check (char_length(source_type) between 1 and 80),
  constraint entitlement_periods_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint entitlement_periods_metadata_size check (octet_length(metadata::text) <= 16384)
);

create unique index entitlement_periods_source_unique_idx
  on public.entitlement_periods (source_type, source_id)
  where source_id is not null;
create index entitlement_periods_user_end_idx
  on public.entitlement_periods (user_id, ends_at desc);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  status text not null default 'succeeded',
  created_at timestamptz not null default now(),
  constraint usage_events_operation check (operation in ('chat', 'translate', 'language_assist', 'content')),
  constraint usage_events_tokens check (input_tokens >= 0 and output_tokens >= 0),
  constraint usage_events_cost check (estimated_cost_usd >= 0 and estimated_cost_usd <= 1000),
  constraint usage_events_status check (status in ('succeeded', 'failed', 'rejected')),
  constraint usage_events_provider_length check (char_length(provider) between 1 and 40),
  constraint usage_events_model_length check (char_length(model) between 1 and 120)
);

create unique index usage_events_request_unique_idx on public.usage_events (request_id);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  error_code text,
  constraint webhook_events_provider check (provider in ('paddle', 'paypal')),
  constraint webhook_events_status check (status in ('received', 'processed', 'ignored', 'failed')),
  constraint webhook_events_provider_event_length check (char_length(provider_event_id) between 1 and 255),
  constraint webhook_events_type_length check (char_length(event_type) between 1 and 120),
  constraint webhook_events_error_length check (error_code is null or char_length(error_code) <= 120)
);

create unique index webhook_events_provider_event_unique_idx
  on public.webhook_events (provider, provider_event_id);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlement_periods enable row level security;
alter table public.usage_events enable row level security;
alter table public.webhook_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy user_preferences_select_own on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_insert_own on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_preferences_update_own on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy vocabulary_items_select_own on public.vocabulary_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy vocabulary_items_insert_own on public.vocabulary_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vocabulary_items_update_own on public.vocabulary_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy vocabulary_items_delete_own on public.vocabulary_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy entitlement_periods_select_own on public.entitlement_periods
  for select to authenticated using ((select auth.uid()) = user_id);
create policy usage_events_select_own on public.usage_events
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.user_preferences from anon;
revoke all on table public.vocabulary_items from anon;
revoke all on table public.subscriptions from anon;
revoke all on table public.entitlement_periods from anon;
revoke all on table public.usage_events from anon;
revoke all on table public.webhook_events from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.vocabulary_items to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.entitlement_periods to authenticated;
grant select on table public.usage_events to authenticated;

comment on table public.profiles is 'Cloud-synced Wyth profile metadata. No chat or companion content.';
comment on table public.user_preferences is 'Cloud-synced presentation and language preferences.';
comment on table public.vocabulary_items is 'Cloud-synced user vocabulary.';
comment on table public.subscriptions is 'Server-written subscription state from verified payment webhooks.';
comment on table public.entitlement_periods is 'Server-written trial, referral, subscription, and top-up access periods.';
comment on table public.usage_events is 'Server-written hosted-operation usage ledger containing metrics only.';
comment on table public.webhook_events is 'Server-only payment webhook idempotency and processing state.';
