-- Registra na carteira os disparos de reativação que já foram confirmados pela Meta.
insert into public.budget_reactivation_interactions (
  lead_id,
  channel,
  outcome,
  note,
  seller,
  created_at
)
select
  recipient.budget_reactivation_lead_id,
  'whatsapp',
  'message_sent',
  left(
    'Disparo em massa · campanha ' || campaign.id || ' · template ' || campaign.template_name ||
      case when nullif(recipient.meta_message_id, '') is not null then ' · Meta ' || recipient.meta_message_id else '' end,
    1000
  ),
  coalesce(lead.assignee, 'James'),
  coalesce(recipient.sent_at, campaign.created_at)
from public.whatsapp_bulk_campaign_recipients recipient
join public.whatsapp_bulk_campaigns campaign on campaign.id = recipient.campaign_id
join public.budget_reactivation_leads lead on lead.id = recipient.budget_reactivation_lead_id
where campaign.source = 'budget_reactivation'
  and recipient.status = 'sent'
  and recipient.budget_reactivation_lead_id is not null
  and not exists (
    select 1
    from public.budget_reactivation_interactions existing
    where existing.lead_id = recipient.budget_reactivation_lead_id
      and existing.channel = 'whatsapp'
      and existing.outcome = 'message_sent'
      and existing.note like '%campanha ' || campaign.id || ' ·%'
  );

update public.budget_reactivation_leads lead
set
  status = case when lead.status in ('pending', 'in_progress') then 'contacted' else lead.status end,
  last_contact_at = coalesce(
    (
      select max(interaction.created_at)
      from public.budget_reactivation_interactions interaction
      where interaction.lead_id = lead.id
        and interaction.channel = 'whatsapp'
        and interaction.outcome = 'message_sent'
    ),
    lead.last_contact_at
  )
where exists (
  select 1
  from public.budget_reactivation_interactions interaction
  where interaction.lead_id = lead.id
    and interaction.channel = 'whatsapp'
    and interaction.outcome = 'message_sent'
);
