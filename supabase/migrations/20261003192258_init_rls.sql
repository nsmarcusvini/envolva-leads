-- Envolva Leads — Row Level Security
--
-- A ferramenta e de uso proprio, mas os dados sao de terceiros (telefone de
-- comercio), entao todo acesso passa pela sessao do usuario. Nada de
-- service-role espalhado pelo app.
--
-- auth.uid() vem embrulhado em (select ...) de proposito: assim o planner
-- avalia uma vez por query em vez de uma vez por linha, o que importa na
-- tabela de leads.

-- ---------------------------------------------------------------------------
-- message_templates
-- ---------------------------------------------------------------------------

alter table public.message_templates enable row level security;

create policy "templates: owner reads"
  on public.message_templates for select to authenticated
  using (user_id = (select auth.uid()));

create policy "templates: owner inserts"
  on public.message_templates for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "templates: owner updates"
  on public.message_templates for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "templates: owner deletes"
  on public.message_templates for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- searches
-- ---------------------------------------------------------------------------

alter table public.searches enable row level security;

create policy "searches: owner reads"
  on public.searches for select to authenticated
  using (user_id = (select auth.uid()));

create policy "searches: owner inserts"
  on public.searches for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "searches: owner updates"
  on public.searches for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "searches: owner deletes"
  on public.searches for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- search_tiles
-- ---------------------------------------------------------------------------

alter table public.search_tiles enable row level security;

create policy "tiles: owner reads"
  on public.search_tiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tiles: owner inserts"
  on public.search_tiles for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "tiles: owner updates"
  on public.search_tiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tiles: owner deletes"
  on public.search_tiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

alter table public.leads enable row level security;

create policy "leads: owner reads"
  on public.leads for select to authenticated
  using (user_id = (select auth.uid()));

create policy "leads: owner inserts"
  on public.leads for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "leads: owner updates"
  on public.leads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "leads: owner deletes"
  on public.leads for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- lead_searches
-- ---------------------------------------------------------------------------

alter table public.lead_searches enable row level security;

create policy "lead_searches: owner reads"
  on public.lead_searches for select to authenticated
  using (user_id = (select auth.uid()));

create policy "lead_searches: owner inserts"
  on public.lead_searches for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "lead_searches: owner updates"
  on public.lead_searches for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "lead_searches: owner deletes"
  on public.lead_searches for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- opt_outs
--
-- Sem policy de DELETE: um opt-out e uma manifestacao do titular e nao deve
-- ser removivel pela UI. Se precisar mesmo apagar, tem que ser deliberado,
-- via SQL no dashboard.
-- ---------------------------------------------------------------------------

alter table public.opt_outs enable row level security;

create policy "opt_outs: owner reads"
  on public.opt_outs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "opt_outs: owner inserts"
  on public.opt_outs for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- lead_events
--
-- Append-only: sem policy de UPDATE nem de DELETE. Trilha de auditoria que
-- pode ser reescrita nao e trilha de auditoria.
-- ---------------------------------------------------------------------------

alter table public.lead_events enable row level security;

create policy "lead_events: owner reads"
  on public.lead_events for select to authenticated
  using (user_id = (select auth.uid()));

create policy "lead_events: owner inserts"
  on public.lead_events for insert to authenticated
  with check (user_id = (select auth.uid()));
