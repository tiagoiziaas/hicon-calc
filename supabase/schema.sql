-- Hicon Calc: tabela dos calculos salvos.
-- Rode uma vez no Supabase: SQL Editor -> New query -> cole tudo -> Run.

create table if not exists public.calculos (
  id              uuid primary key default gen_random_uuid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  nome_cliente    text,
  numero_contrato text,
  data_referencia date,
  -- "total" ou "parcial": qual Minuta estava selecionada ao salvar
  modelo          text check (modelo in ('total', 'parcial')),
  -- tudo o que foi digitado nos 3 cenarios (contrato, hiscon, in28)
  cenarios        jsonb not null,
  -- taxa media do Bacen usada (decimal, ex.: 0.0153) e o periodo consultado
  taxa_media      numeric,
  bacen           jsonb,
  -- resumo dos resultados de cada aba (Minuta Total e Parcial) no momento em que foi salvo
  resultados      jsonb
);

create index if not exists calculos_atualizado_em_idx on public.calculos (atualizado_em desc);
create index if not exists calculos_nome_cliente_idx on public.calculos (lower(nome_cliente));
create index if not exists calculos_numero_contrato_idx on public.calculos (numero_contrato);

-- atualizado_em sempre com a hora da ultima gravacao
create or replace function public.calculos_tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists calculos_atualizado_em on public.calculos;
create trigger calculos_atualizado_em
  before update on public.calculos
  for each row execute function public.calculos_tocar_atualizado_em();

-- Acesso: o site usa a chave publica (papel "anon"), SEM login.
-- Decisao do escritorio: qualquer pessoa com o link do site pode salvar, ver e
-- atualizar calculos. Apagar NAO e permitido pelo site (so pelo painel do Supabase).
alter table public.calculos enable row level security;

drop policy if exists "site pode ler" on public.calculos;
create policy "site pode ler" on public.calculos for select to anon, authenticated using (true);

drop policy if exists "site pode salvar" on public.calculos;
create policy "site pode salvar" on public.calculos for insert to anon, authenticated with check (true);

drop policy if exists "site pode atualizar" on public.calculos;
create policy "site pode atualizar" on public.calculos for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.calculos to anon, authenticated;
