-- Settled: usage stats
-- Paste any query into Supabase -> SQL Editor to see how the app is doing.
-- A "user" is one device/browser (anonymous sign-in), not a verified person.

-- Total users ever
select count(*) as total_users from auth.users where is_anonymous;

-- New users per day (last 30 days)
select date(created_at) as day, count(*) as new_users
from auth.users
where is_anonymous and created_at > now() - interval '30 days'
group by day order by day desc;

-- Active users per week (anyone who created or joined a room)
select date_trunc('week', joined_at)::date as week, count(distinct user_id) as active_users
from public.participants
group by week order by week desc;

-- Rooms created, completed, and completion rate
select count(*) as rooms,
       count(*) filter (where status = 'results' or round > 1) as reached_result,
       round(100.0 * count(*) filter (where status = 'results' or round > 1) / nullif(count(*), 0), 1) as completion_pct
from public.rooms;

-- Eat vs watch
select category, count(*) as rooms from public.rooms group by category;

-- Average group size
select round(avg(n), 1) as avg_people_per_room
from (select room_id, count(*) as n from public.participants group by room_id) t;

-- Returning users (used the app on 2+ different days)
select count(*) as returning_users
from (
  select user_id from public.participants
  group by user_id having count(distinct date(joined_at)) >= 2
) t;

-- Feedback and problem reports, newest first
select created_at, message, contact, page
from public.feedback
order by created_at desc;
