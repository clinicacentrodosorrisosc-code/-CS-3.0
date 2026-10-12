alter table public.budget_reactivation_leads
  add column if not exists import_key text;

create unique index if not exists budget_reactivation_leads_import_key_unique
  on public.budget_reactivation_leads(import_key)
  where import_key is not null;
