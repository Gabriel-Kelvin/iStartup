-- iStartup Junior Season 1. Run once in the dedicated Supabase project's SQL editor.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 80),
  role text not null default 'judge' check (role in ('judge', 'admin')),
  created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  team_members text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete cascade,
  value numeric not null check (value >= 0),
  submitted_at timestamptz not null default now()
);
create table public.score_reveals (
  project_id uuid not null references public.projects(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete cascade,
  is_revealed boolean not null default false,
  primary key (project_id, judge_id)
);
-- Only these two public projection tables are readable by guests.
create table public.published_scores (
  id uuid primary key references public.scores(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete cascade,
  value numeric not null check (value >= 0)
);
create table public.published_totals (
  project_id uuid primary key references public.projects(id) on delete cascade,
  value numeric not null check (value >= 0)
);
create index scores_judge_id_idx on public.scores(judge_id);
create index scores_project_judge_idx on public.scores(project_id, judge_id);
create index score_reveals_judge_id_idx on public.score_reveals(judge_id);
create index published_scores_judge_id_idx on public.published_scores(judge_id);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.new_user_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)), 'judge');
  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users for each row execute function private.new_user_profile();

create or replace function private.refresh_project_publication(target_project uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.published_scores where project_id = target_project;
  insert into public.published_scores (id, project_id, judge_id, value)
  select s.id, s.project_id, s.judge_id, s.value
  from public.scores s join public.score_reveals r
    on r.project_id = s.project_id and r.judge_id = s.judge_id
  where s.project_id = target_project and r.is_revealed;

  if exists (select 1 from public.published_scores where project_id = target_project) then
    insert into public.published_totals (project_id, value)
    select target_project, sum(value) from public.published_scores where project_id = target_project
    on conflict (project_id) do update set value = excluded.value;
  else
    delete from public.published_totals where project_id = target_project;
  end if;
end;
$$;
revoke all on function private.refresh_project_publication(uuid) from public, anon, authenticated;

create or replace function private.sync_publication()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_project_publication(case when tg_op = 'DELETE' then old.project_id else new.project_id end);
  return coalesce(new, old);
end;
$$;
create trigger on_score_changed after insert or update or delete on public.scores
for each row execute function private.sync_publication();
create trigger on_score_reveal_changed after insert or update or delete on public.score_reveals
for each row execute function private.sync_publication();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.scores enable row level security;
alter table public.score_reveals enable row level security;
alter table public.published_scores enable row level security;
alter table public.published_totals enable row level security;

create policy "guests see judge names" on public.profiles for select to anon
using (role = 'judge');
create policy "signed in see own profile or admin sees all" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
create policy "everyone sees projects" on public.projects for select to anon, authenticated using (true);
create policy "admin creates projects" on public.projects for insert to authenticated with check ((select private.is_admin()));
create policy "admin edits projects" on public.projects for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes projects" on public.projects for delete to authenticated using ((select private.is_admin()));
create policy "judge sees own scores and admin sees all" on public.scores for select to authenticated
using (judge_id = (select auth.uid()) or (select private.is_admin()));
create policy "judges add scores" on public.scores for insert to authenticated
with check (judge_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'judge'
));
create policy "judges edit own scores" on public.scores for update to authenticated
using (judge_id = (select auth.uid()))
with check (judge_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'judge'
));
create policy "judges delete own scores" on public.scores for delete to authenticated
using (judge_id = (select auth.uid()));
create policy "admin sees score reveals" on public.score_reveals for select to authenticated using ((select private.is_admin()));
create policy "admin creates score reveals" on public.score_reveals for insert to authenticated with check ((select private.is_admin()));
create policy "admin changes score reveals" on public.score_reveals for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "everyone sees published scores" on public.published_scores for select to anon, authenticated using (true);
create policy "everyone sees published totals" on public.published_totals for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.projects, public.published_scores, public.published_totals to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.scores, public.score_reveals to authenticated;
grant insert, update, delete on public.projects to authenticated;
grant insert, update, delete on public.scores to authenticated;
grant insert, update on public.score_reveals to authenticated;
