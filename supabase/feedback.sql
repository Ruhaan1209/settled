-- Settled: feedback / problem reports
-- Run this once in Supabase -> SQL Editor (after schema.sql).
-- Messages land in the "feedback" table; read them in Table Editor or with
-- the query at the bottom of stats.sql. Visitors can send but never read.

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  message    text not null check (char_length(message) between 1 and 2000),
  contact    text check (char_length(contact) <= 200),
  page       text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index feedback_user_idx on public.feedback (user_id, created_at);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(
  p_message text,
  p_contact text default null,
  p_page text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := left(btrim(coalesce(p_message, '')), 2000);
  v_contact text := nullif(left(btrim(coalesce(p_contact, '')), 200), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if v_message = '' then
    raise exception 'Write a message first';
  end if;

  -- Light spam protection: at most 5 messages per device per hour
  if (select count(*) from feedback
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Thanks! You''ve sent a few already, try again later';
  end if;

  insert into feedback (user_id, message, contact, page, user_agent)
  values (auth.uid(), v_message, v_contact, left(p_page, 200), left(p_user_agent, 300));
end;
$$;

revoke execute on function public.submit_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text) to authenticated;
