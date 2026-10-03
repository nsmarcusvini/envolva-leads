-- Envolva Leads — schema inicial
--
-- Prospeccao de comercios locais com presenca fraca no Google, para oferta de
-- plaquinhas NFC "Avalie no Google".
--
-- Fonte de dados: Google Places API (New), endpoint places:searchText.
-- A API tem teto rigido de 60 resultados por consulta (3 paginas x 20), por isso
-- a coleta e fatiada em tiles (bairro x categoria) e cada tile guarda seu proprio
-- page_token -- o que torna a coleta paginavel, resumivel e auditavel em custo.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.search_status as enum ('queued', 'running', 'done', 'error', 'canceled');
create type public.tile_status   as enum ('queued', 'running', 'done', 'error');
create type public.phone_type    as enum ('mobile', 'landline', 'unknown');
create type public.lead_tier     as enum ('A', 'B', 'C');
create type public.lead_status   as enum ('novo', 'contatado', 'interessado', 'fechado', 'descartado');

create type public.lead_event_type as enum (
  'created', 'status_change', 'message_copied', 'note', 'optout', 'refreshed'
);

-- ---------------------------------------------------------------------------
-- Util: trigger de updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- message_templates — as variacoes de abordagem do WhatsApp
--
-- Criada antes de leads porque leads referencia o template atribuido.
-- O corpo usa tokens {{nome}} {{nome_curto}} {{bairro}} {{categoria}}
-- {{nota}} {{avaliacoes}}, renderizados em lib/messages.ts.
-- ---------------------------------------------------------------------------

create table public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  body        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index message_templates_user_active_idx
  on public.message_templates (user_id, active, sort_order);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- searches — um job de coleta
-- ---------------------------------------------------------------------------

create table public.searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  label         text not null,
  city          text not null,
  neighborhoods text[] not null default '{}',
  categories    text[] not null default '{}',
  -- languageCode, regionCode e filtros opcionais aplicados na coleta
  params        jsonb not null default '{}'::jsonb,
  status        public.search_status not null default 'queued',

  -- progresso e custo: 1 step = 1 pagina = 1 request faturavel
  tiles_total   integer not null default 0,
  tiles_done    integer not null default 0,
  places_found  integer not null default 0,
  leads_new     integer not null default 0,
  api_requests  integer not null default 0,
  est_cost_usd  numeric(10, 4) not null default 0,

  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz,

  constraint searches_has_tiles check (
    cardinality(neighborhoods) > 0 and cardinality(categories) > 0
  )
);

create index searches_user_created_idx on public.searches (user_id, created_at desc);
create index searches_user_status_idx  on public.searches (user_id, status);

create trigger searches_set_updated_at
  before update on public.searches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- search_tiles — uma consulta (bairro x categoria) dentro de uma busca
--
-- user_id e denormalizado de proposito: deixa a policy de RLS trivial, sem
-- subquery na tabela pai a cada linha.
-- ---------------------------------------------------------------------------

create table public.search_tiles (
  id              uuid primary key default gen_random_uuid(),
  search_id       uuid not null references public.searches (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  neighborhood    text not null,
  category        text not null,
  -- o textQuery literal enviado a API, guardado para reproduzir a consulta
  text_query      text not null,
  status          public.tile_status not null default 'queued',
  pages_fetched   integer not null default 0,
  next_page_token text,
  results_count   integer not null default 0,
  -- true quando o tile bateu o teto de 60: existe mais resultado que a API nao
  -- entrega, sinal de que o bairro precisa ser refinado
  saturated       boolean not null default false,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint search_tiles_unique_per_search unique (search_id, neighborhood, category)
);

create index search_tiles_search_status_idx on public.search_tiles (search_id, status);
create index search_tiles_user_idx          on public.search_tiles (user_id);

create trigger search_tiles_set_updated_at
  before update on public.search_tiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- opt_outs — LGPD
--
-- Tabela separada de proposito: um opt-out precisa BLOQUEAR reimportacao numa
-- busca futura, entao nao pode morrer junto com o lead. Criada antes de leads
-- porque o trigger de bloqueio em leads consulta esta tabela.
-- ---------------------------------------------------------------------------

create table public.opt_outs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  phone_e164  text,
  place_id    text,
  reason      text,
  created_at  timestamptz not null default now(),

  constraint opt_outs_needs_identifier check (
    phone_e164 is not null or place_id is not null
  )
);

create unique index opt_outs_user_phone_key
  on public.opt_outs (user_id, phone_e164) where phone_e164 is not null;

create unique index opt_outs_user_place_key
  on public.opt_outs (user_id, place_id) where place_id is not null;

-- ---------------------------------------------------------------------------
-- leads — o comercio, deduplicado por place_id
-- ---------------------------------------------------------------------------

create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,

  -- identidade no Google; a unique com user_id e o que garante o dedup
  place_id            text not null,
  name                text not null,
  formatted_address   text,
  city                text,
  -- extraido de addressComponents (sublocality) com fallback para o bairro do tile
  neighborhood        text,
  lat                 double precision,
  lng                 double precision,

  phone_raw           text,
  phone_e164          text,
  phone_type          public.phone_type not null default 'unknown',
  -- "likely" e nao "has": celular e probabilidade de WhatsApp, nao prova
  whatsapp_likely     boolean not null default false,

  website             text,
  has_website         boolean generated always as (
                        website is not null and length(btrim(website)) > 0
                      ) stored,

  primary_type        text,
  types               text[] not null default '{}',

  rating              numeric(2, 1),
  reviews_count       integer,
  business_status     text,
  google_maps_uri     text,

  score               integer not null default 0,
  -- justificativas legiveis, exibidas na UI: score sem motivo visivel e score
  -- em que nao se confia
  score_reasons       text[] not null default '{}',
  tier                public.lead_tier not null default 'C',

  status              public.lead_status not null default 'novo',
  notes               text,

  -- atribuido no insert por hash(place_id), entao nunca muda sozinho depois
  message_template_id uuid references public.message_templates (id) on delete set null,

  first_seen_search_id uuid references public.searches (id) on delete set null,
  last_refreshed_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint leads_place_unique_per_user unique (user_id, place_id),
  constraint leads_rating_range check (rating is null or (rating >= 0 and rating <= 5)),
  constraint leads_reviews_nonneg check (reviews_count is null or reviews_count >= 0),
  constraint leads_score_range check (score between 0 and 100)
);

create index leads_user_score_idx        on public.leads (user_id, score desc);
create index leads_user_status_idx       on public.leads (user_id, status);
create index leads_user_tier_idx         on public.leads (user_id, tier);
create index leads_user_neighborhood_idx on public.leads (user_id, neighborhood);
create index leads_user_type_idx         on public.leads (user_id, primary_type);
create index leads_user_phone_idx        on public.leads (user_id, phone_e164);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Backstop de LGPD: impede que uma coleta futura reinsira um lead que pediu
-- para sair. Vale so no INSERT -- no UPDATE continua liberado, para que ainda
-- seja possivel marcar como descartado ou anotar algo num lead ja existente.
-- A camada de aplicacao tambem filtra, para poder relatar "N ignorados por
-- opt-out"; este trigger e a garantia de que esquecer esse filtro nao vira
-- problema legal.
create or replace function public.block_opted_out_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.opt_outs o
    where o.user_id = new.user_id
      and (
        (o.place_id is not null and o.place_id = new.place_id)
        or (o.phone_e164 is not null and new.phone_e164 is not null
            and o.phone_e164 = new.phone_e164)
      )
  ) then
    return null; -- descarta a linha sem abortar o lote
  end if;

  return new;
end;
$$;

create trigger leads_block_opted_out
  before insert on public.leads
  for each row execute function public.block_opted_out_leads();

-- ---------------------------------------------------------------------------
-- lead_searches — procedencia
--
-- O mesmo comercio aparecer em duas buscas nao cria dois leads: cria duas
-- linhas aqui.
-- ---------------------------------------------------------------------------

create table public.lead_searches (
  lead_id    uuid not null references public.leads (id) on delete cascade,
  search_id  uuid not null references public.searches (id) on delete cascade,
  tile_id    uuid references public.search_tiles (id) on delete set null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- posicao do lead no ranking devolvido pela API, util para aferir relevancia
  position   integer,
  created_at timestamptz not null default now(),

  primary key (lead_id, search_id)
);

create index lead_searches_search_idx on public.lead_searches (search_id);
create index lead_searches_user_idx   on public.lead_searches (user_id);

-- ---------------------------------------------------------------------------
-- lead_events — auditoria leve ("o que eu mandei e quando")
-- ---------------------------------------------------------------------------

create table public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       public.lead_event_type not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
create index lead_events_user_idx on public.lead_events (user_id, created_at desc);
