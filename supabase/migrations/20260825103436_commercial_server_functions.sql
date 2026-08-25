create unique index entitlement_periods_one_trial_per_user_idx
  on public.entitlement_periods (user_id)
  where kind = 'trial';

create function public.grant_initial_trial(
  p_user_id uuid,
  p_successful_reply_at timestamptz
)
returns setof public.entitlement_periods
language sql
volatile
set search_path = ''
as $$
  insert into public.entitlement_periods (
    user_id,
    kind,
    starts_at,
    ends_at,
    source_type,
    source_id
  )
  values (
    p_user_id,
    'trial',
    p_successful_reply_at,
    p_successful_reply_at + interval '24 hours',
    'first_successful_ai_reply',
    p_user_id::text
  )
  on conflict do nothing
  returning *;
$$;

create function public.commercial_usage_total(
  p_user_id uuid,
  p_since timestamptz
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(estimated_cost_usd), 0)
  from public.usage_events
  where user_id = p_user_id
    and created_at >= p_since
    and status = 'succeeded';
$$;

revoke all on function public.grant_initial_trial(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.commercial_usage_total(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_initial_trial(uuid, timestamptz) to service_role;
grant execute on function public.commercial_usage_total(uuid, timestamptz) to service_role;

comment on function public.grant_initial_trial(uuid, timestamptz)
  is 'Server-only idempotent 24-hour trial grant after the first successful hosted reply.';
comment on function public.commercial_usage_total(uuid, timestamptz)
  is 'Server-only aggregate of successful hosted-operation cost from a trusted period start.';
