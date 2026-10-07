-- Auditoria central: eventos de interface e alteracoes nas tabelas publicas.
create extension if not exists pgcrypto;
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW')),
  module text not null default 'Sistema',
  description text not null,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_module_action_idx on public.audit_logs (module, action, created_at desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create or replace function public.audit_redact(payload jsonb)
returns jsonb language sql immutable set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, case
    when key ~* '(password|passwd|senha|secret|token|api.?key|access.?key|private.?key|authorization|credential|cookie)'
      then '"[PROTEGIDO]"'::jsonb
    else value end), '{}'::jsonb)
  from jsonb_each(coalesce(payload, '{}'::jsonb));
$$;
create or replace function public.record_audit_event(
  p_action text, p_module text, p_description text, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_action not in ('LOGIN', 'LOGOUT', 'VIEW') then raise exception 'Invalid audit action'; end if;
  insert into public.audit_logs (user_id, user_email, action, module, description, metadata)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'Usuario autenticado'), p_action,
    left(coalesce(nullif(trim(p_module), ''), 'Sistema'), 120),
    left(coalesce(nullif(trim(p_description), ''), 'Atividade no sistema'), 500),
    public.audit_redact(coalesce(p_metadata, '{}'::jsonb))) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_audit_event(text, text, text, jsonb) from public;
grant execute on function public.record_audit_event(text, text, text, jsonb) to authenticated;
create or replace function public.capture_audit_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then public.audit_redact(to_jsonb(old)) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then public.audit_redact(to_jsonb(new)) else null end;
  v_record_id text;
  v_module text;
begin
  v_record_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'uuid', v_old ->> 'uuid');
  v_module := case
    when tg_table_name like 'crm_%' or tg_table_name like 'whatsapp_%' then 'CRM'
    when tg_table_name in ('transactions', 'accounts', 'financial_categories') then 'Financeiro'
    when tg_table_name like 'ortho_%' then 'Ortodontia'
    when tg_table_name like 'lab_%' then 'Laboratorio'
    when tg_table_name in ('profiles', 'permissions') then 'Usuarios e permissoes'
    else initcap(replace(tg_table_name, '_', ' ')) end;
  insert into public.audit_logs (user_id, user_email, action, module, description, table_name, record_id, old_data, new_data)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true), 'Sistema/Integracao'),
    tg_op, v_module,
    case tg_op when 'INSERT' then 'Criou um registro em ' when 'UPDATE' then 'Alterou um registro em ' else 'Excluiu um registro de ' end || replace(tg_table_name, '_', ' '),
    tg_table_name, v_record_id, v_old, v_new);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_audit_change() from public;
do $$
declare item record;
begin
  for item in select tablename from pg_tables where schemaname = 'public'
    and tablename <> 'audit_logs'
    and tablename not like 'pg_%'
  loop
    execute format('drop trigger if exists audit_change_trigger on public.%I', item.tablename);
    execute format('create trigger audit_change_trigger after insert or update or delete on public.%I for each row execute function public.capture_audit_change()', item.tablename);
  end loop;
end $$;
comment on table public.audit_logs is 'Historico imutavel de atividades dos usuarios e alteracoes de dados.';
