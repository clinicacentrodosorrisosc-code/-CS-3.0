alter table public.budget_reactivation_leads
  add column if not exists converted_value_cents integer check (converted_value_cents is null or converted_value_cents >= 0);

alter table public.budget_reactivation_interactions
  drop constraint if exists budget_reactivation_interactions_outcome_check;

alter table public.budget_reactivation_interactions
  add constraint budget_reactivation_interactions_outcome_check
  check (outcome in ('answered', 'no_answer', 'message_sent', 'interested', 'not_interested', 'scheduled', 'attended', 'no_show', 'converted'));
