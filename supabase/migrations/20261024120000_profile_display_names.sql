alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = case lower(email)
  when 'clinica.centrodosorrisosc@gmail.com' then 'Centro do Sorriso'
  when 'recepcao.centrodosorriso@gmail.com' then 'Ana'
  else full_name
end
where lower(email) in (
  'clinica.centrodosorrisosc@gmail.com',
  'recepcao.centrodosorriso@gmail.com'
);
