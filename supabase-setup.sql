-- Run this ONCE in Supabase Dashboard -> SQL Editor.
-- HelpPilot's API uses the service-role key (which bypasses RLS), so the
-- browser/anon key must have NO direct access to these tables.

alter table public.apps          enable row level security;
alter table public.workspaces    enable row level security;
alter table public.conversations enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.payments      enable row level security;

-- Remove any old permissive policies that would let the anon key in.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('apps','workspaces','conversations','knowledge_base','payments')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- With RLS on and no policies, anon/authenticated roles get zero rows.

-- Stop the same payment reference being submitted twice.
-- (If this fails with "duplicate key", delete the duplicate rows first.)
create unique index if not exists payments_utr_unique
  on public.payments (lower(utr_number));

-- Speeds up the per-store rate-limit and trial-limit counts.
create index if not exists conversations_app_created_idx
  on public.conversations (app_uuid, created_at desc);

-- Verify: this should return rowsecurity = true for all five tables.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('apps','workspaces','conversations','knowledge_base','payments');
