-- Envolva Leads — seed das variacoes de abordagem
--
-- Cinco textos com tons diferentes, para a abordagem nao parecer robo. Todos
-- oferecem a plaquinha NFC "Avalie no Google" e propoem passar na loja e
-- configurar na hora.
--
-- Tokens disponiveis: {{nome}} {{nome_curto}} {{bairro}} {{categoria}}
--                     {{nota}} {{avaliacoes}}
--
-- Tres templates nao usam token numerico de proposito: valem para qualquer
-- lead, inclusive os sem nota e sem avaliacao nenhuma. Os dois que usam
-- {{nota}} / {{avaliacoes}} sao atribuidos apenas a leads que tem esses dados
-- -- a elegibilidade e resolvida em lib/messages.ts lendo os tokens do corpo,
-- entao nao ha coluna aqui dizendo quais tokens cada um usa.
--
-- O texto que menciona a nota e escrito para funcionar com nota alta OU baixa,
-- sem soar como critica ao comercio.
--
-- Idempotente: nao faz nada se o usuario ja tem templates. Chamada por RPC
-- pelo app quando carrega os templates e encontra a lista vazia. Deliberadamente
-- NAO e um trigger em auth.users -- uma falha no seed nao pode derrubar a
-- criacao da conta.

create or replace function public.seed_default_message_templates()
returns integer
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'seed_default_message_templates: sem sessao autenticada';
  end if;

  if exists (
    select 1 from public.message_templates where user_id = v_user_id
  ) then
    return 0;
  end if;

  insert into public.message_templates (user_id, name, body, sort_order)
  values
    (
      v_user_id,
      'Direto e curto',
      $t$Oi! Tudo bem? Passando aqui porque vi o {{nome}} no Google Maps.

Eu trabalho com uma plaquinha NFC de "Avalie no Google" — o cliente encosta o celular e cai direto na tela de avaliacao, sem precisar procurar nada.

Costuma aumentar bem o numero de avaliacoes e e simples de usar. Posso passar ai no {{bairro}} pra te mostrar e ja deixar configurada na hora, sem compromisso. Topa?$t$,
      1
    ),
    (
      v_user_id,
      'Foco em poucas avaliacoes',
      $t$Ola! Vi o {{nome}} no Google e notei que voces tem {{avaliacoes}} avaliacoes por la.

Pra {{categoria}}, isso pesa bastante em quanto voces aparecem pra quem esta buscando por perto — e geralmente nao e falta de cliente satisfeito, e so que ninguem lembra de avaliar na hora.

Eu levo uma plaquinha NFC de "Avalie no Google": o cliente aproxima o celular e a tela de avaliacao abre na hora. Posso passar ai pra mostrar e configurar na hora. Quando fica bom pra voce?$t$,
      2
    ),
    (
      v_user_id,
      'Tom de vizinho',
      $t$Oi, bom dia! Falo com alguem do {{nome_curto}}?

Sou daqui da regiao e trabalho com uma coisa bem simples: uma plaquinha de NFC que fica no balcao, o cliente encosta o celular e abre direto a avaliacao do Google de voces.

Sem app, sem cadastro, sem mensalidade. Eu que configuro, leva uns 2 minutos.

Posso dar uma passada ai essa semana pra voce ver funcionando?$t$,
      3
    ),
    (
      v_user_id,
      'Menciona a nota',
      $t$Oi! Tudo certo?

Dei uma olhada no {{nome}} no Google Maps e vi que a nota de voces esta em {{nota}}. Uma coisa que quase ninguem faz e que resolve rapido: facilitar pro cliente satisfeito deixar a avaliacao dele.

Eu trabalho com plaquinha NFC de "Avalie no Google" — fica no balcao, o cliente encosta o celular e a avaliacao abre direto. Os contentes avaliam, a nota acompanha.

Passo ai no {{bairro}} pra instalar e configurar na hora. Pode ser?$t$,
      4
    ),
    (
      v_user_id,
      'Abre com pergunta',
      $t$Oi! O {{nome_curto}} usa alguma coisa pra pedir avaliacao no Google pros clientes?

Pergunto porque eu levo uma plaquinha NFC que faz isso sozinha: o cliente encosta o celular, abre a avaliacao, pronto. Instalo e configuro na hora, ai mesmo.

Se fizer sentido, dou uma passada ai pra te mostrar. Qual o melhor horario?$t$,
      5
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$fn$;

grant execute on function public.seed_default_message_templates() to authenticated;
