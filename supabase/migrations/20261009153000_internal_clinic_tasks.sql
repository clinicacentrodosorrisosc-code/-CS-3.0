-- Ambiente interno de trabalhos e tarefas da clinica. Nao inclui laboratorio.
create extension if not exists pgcrypto;

create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  color text not null default '#2563eb',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.task_projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 240),
  description text,
  status text not null default 'todo' check (status in ('todo', 'progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  checklist jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.clinic_tasks(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 3000),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists clinic_tasks_project_status_idx on public.clinic_tasks(project_id, status);
create index if not exists clinic_tasks_assignee_due_date_idx on public.clinic_tasks(assignee_id, due_date);
create index if not exists clinic_task_comments_task_created_idx on public.clinic_task_comments(task_id, created_at);

create or replace function public.set_task_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists task_projects_updated_at on public.task_projects;
create trigger task_projects_updated_at before update on public.task_projects for each row execute function public.set_task_updated_at();
drop trigger if exists clinic_tasks_updated_at on public.clinic_tasks;
create trigger clinic_tasks_updated_at before update on public.clinic_tasks for each row execute function public.set_task_updated_at();

alter table public.task_projects enable row level security;
alter table public.clinic_tasks enable row level security;
alter table public.clinic_task_comments enable row level security;
drop policy if exists task_projects_team_access on public.task_projects;
create policy task_projects_team_access on public.task_projects for all to authenticated using (true) with check (true);
drop policy if exists clinic_tasks_team_access on public.clinic_tasks;
create policy clinic_tasks_team_access on public.clinic_tasks for all to authenticated using (true) with check (true);
drop policy if exists clinic_task_comments_team_access on public.clinic_task_comments;
create policy clinic_task_comments_team_access on public.clinic_task_comments for all to authenticated using (true) with check (true);

do $$
begin
  if to_regprocedure('public.capture_audit_change()') is not null then
    execute 'drop trigger if exists audit_change_trigger on public.task_projects';
    execute 'create trigger audit_change_trigger after insert or update or delete on public.task_projects for each row execute function public.capture_audit_change()';
    execute 'drop trigger if exists audit_change_trigger on public.clinic_tasks';
    execute 'create trigger audit_change_trigger after insert or update or delete on public.clinic_tasks for each row execute function public.capture_audit_change()';
    execute 'drop trigger if exists audit_change_trigger on public.clinic_task_comments';
    execute 'create trigger audit_change_trigger after insert or update or delete on public.clinic_task_comments for each row execute function public.capture_audit_change()';
  end if;
end $$;
