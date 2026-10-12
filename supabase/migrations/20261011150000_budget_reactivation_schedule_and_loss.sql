alter table public.budget_reactivation_interactions
  add column if not exists scheduled_for timestamptz;

alter table public.budget_reactivation_interactions
  drop constraint if exists budget_reactivation_interactions_outcome_check;

alter table public.budget_reactivation_interactions
  add constraint budget_reactivation_interactions_outcome_check
  check (outcome in (
    'answered',
    'no_answer',
    'message_sent',
    'interested',
    'not_interested',
    'already_treated',
    'scheduled',
    'attended',
    'no_show',
    'converted',
    'lost'
  ));
