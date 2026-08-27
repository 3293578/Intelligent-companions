alter table public.subscriptions
  add column last_provider_event_at timestamptz not null default '-infinity'::timestamptz;

create function public.apply_paddle_subscription_event(
  p_provider_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_user_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_plan text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_event_id bigint;
begin
  insert into public.webhook_events (
    provider,
    provider_event_id,
    event_type,
    occurred_at,
    status
  ) values (
    'paddle',
    p_provider_event_id,
    p_event_type,
    p_occurred_at,
    'received'
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return false;
  end if;

  insert into public.subscriptions (
    user_id,
    provider,
    provider_customer_id,
    provider_subscription_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    last_provider_event_at
  ) values (
    p_user_id,
    'paddle',
    p_provider_customer_id,
    p_provider_subscription_id,
    p_plan,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    p_occurred_at
  )
  on conflict (provider, provider_subscription_id) do update
  set provider_customer_id = excluded.provider_customer_id,
      plan = excluded.plan,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      last_provider_event_at = excluded.last_provider_event_at,
      updated_at = now()
  where excluded.last_provider_event_at >= public.subscriptions.last_provider_event_at;

  update public.webhook_events
  set status = 'processed', processed_at = now(), error_code = null
  where id = inserted_event_id;

  return true;
end;
$$;

revoke all on function public.apply_paddle_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.apply_paddle_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, timestamptz, boolean
) to service_role;

comment on function public.apply_paddle_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, timestamptz, timestamptz, boolean
) is 'Atomically records one verified Paddle event and synchronizes its subscription state.';
