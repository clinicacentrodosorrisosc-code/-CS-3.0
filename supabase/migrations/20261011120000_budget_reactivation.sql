-- Carteira operacional para reativacao de orcamentos perdidos e vencidos.
create extension if not exists pgcrypto;

create table if not exists public.budget_reactivation_leads (
  id uuid primary key default gen_random_uuid(),
  crm_opportunity_id uuid references public.clinic_experts_opportunities(id) on delete set null,
  patient_name text not null check (char_length(trim(patient_name)) between 2 and 160),
  phone text not null check (char_length(regexp_replace(phone, '\\D', '', 'g')) between 10 and 15),
  budget_value_cents integer not null default 0 check (budget_value_cents >= 0),
  budget_date date,
  source_status text not null default 'lost' check (source_status in ('lost', 'expired')),
  assignee text check (assignee in ('James', 'Priscila')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'contacted', 'scheduled', 'converted', 'unreachable', 'closed')),
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_reactivation_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.budget_reactivation_leads(id) on delete cascade,
  channel text not null check (channel in ('call', 'whatsapp')),
  outcome text not null check (outcome in ('answered', 'no_answer', 'message_sent', 'interested', 'not_interested', 'scheduled', 'converted')),
  note text,
  seller text not null check (seller in ('James', 'Priscila')),
  created_at timestamptz not null default now()
);

create index if not exists budget_reactivation_leads_queue_idx on public.budget_reactivation_leads(status, assignee, next_follow_up_at);
create index if not exists budget_reactivation_interactions_lead_created_idx on public.budget_reactivation_interactions(lead_id, created_at desc);

create or replace function public.set_budget_reactivation_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists budget_reactivation_leads_updated_at on public.budget_reactivation_leads;
create trigger budget_reactivation_leads_updated_at before update on public.budget_reactivation_leads for each row execute function public.set_budget_reactivation_updated_at();

alter table public.budget_reactivation_leads enable row level security;
alter table public.budget_reactivation_interactions enable row level security;
drop policy if exists budget_reactivation_leads_team_access on public.budget_reactivation_leads;
create policy budget_reactivation_leads_team_access on public.budget_reactivation_leads for all to authenticated using (true) with check (true);
drop policy if exists budget_reactivation_interactions_team_access on public.budget_reactivation_interactions;
create policy budget_reactivation_interactions_team_access on public.budget_reactivation_interactions for all to authenticated using (true) with check (true);

do $$
begin
  if to_regprocedure('public.capture_audit_change()') is not null then
    execute 'drop trigger if exists audit_change_trigger on public.budget_reactivation_leads';
    execute 'create trigger audit_change_trigger after insert or update or delete on public.budget_reactivation_leads for each row execute function public.capture_audit_change()';
    execute 'drop trigger if exists audit_change_trigger on public.budget_reactivation_interactions';
    execute 'create trigger audit_change_trigger after insert or update or delete on public.budget_reactivation_interactions for each row execute function public.capture_audit_change()';
  end if;
end $$;
