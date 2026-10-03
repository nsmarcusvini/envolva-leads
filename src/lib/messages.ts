/**
 * Geracao das abordagens de WhatsApp.
 *
 * COMPLIANCE: este modulo so monta texto e URL. Nada aqui dispara mensagem,
 * e nao existe nenhuma chamada de rede para wa.me ou para a API do WhatsApp
 * em nenhum ponto do projeto -- o envio e sempre um clique manual.
 */

export const MESSAGE_TOKENS = [
  'nome',
  'nome_curto',
  'bairro',
  'categoria',
  'nota',
  'avaliacoes',
] as const

export type MessageToken = (typeof MESSAGE_TOKENS)[number]

export interface MessageLead {
  placeId: string
  name: string
  neighborhood: string | null
  categoryLabel: string | null
  rating: number | null
  reviewsCount: number | null
  phoneE164: string | null
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
}

const TOKEN_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g

/**
 * Palavras genericas de inicio de nome de comercio. Servem para achar o nome
 * pelo qual a pessoa e chamada de verdade: "Bar do Ze" -> "Ze",
 * "Pizzaria Dom Pedro" -> "Dom Pedro".
 */
const GENERIC_PREFIXES = new Set([
  'restaurante', 'bar', 'botequim', 'boteco', 'padaria', 'panificadora',
  'pizzaria', 'lanchonete', 'hamburgueria', 'churrascaria', 'sorveteria',
  'doceria', 'confeitaria', 'cafe', 'cafeteria', 'acai', 'acaiteria',
  'mercado', 'mercadinho', 'supermercado', 'minimercado', 'emporio',
  'barbearia', 'salao', 'studio', 'estudio', 'clinica', 'consultorio',
  'petshop', 'pet', 'shop', 'loja', 'otica', 'farmacia', 'drogaria',
  'academia', 'oficina', 'autocenter', 'borracharia', 'lavanderia',
  'floricultura', 'deposito', 'distribuidora', 'atacado', 'casa', 'espaco',
  'centro', 'instituto', 'grupo', 'comercial',
])

/** Conectores que sobram depois de remover o prefixo generico. */
const CONNECTORS = new Set(['do', 'da', 'de', 'dos', 'das', 'e', 'o', 'a', 'em'])

function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Nome curto, para a mensagem soar como gente e nao como mala direta.
 * Se remover tudo nao sobrar nada (ex: o comercio se chama so "Padaria"),
 * devolve o nome inteiro.
 */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  let start = 0

  while (start < words.length) {
    const bare = deaccent(words[start]).toLowerCase().replace(/[^a-z]/g, '')
    if (GENERIC_PREFIXES.has(bare) || (start > 0 && CONNECTORS.has(bare))) {
      start += 1
      continue
    }
    break
  }

  const rest = words.slice(start).join(' ').trim()
  return rest.length > 0 ? rest : name.trim()
}

/** Quais tokens um corpo de template realmente usa. */
export function tokensUsed(body: string): MessageToken[] {
  const found = new Set<MessageToken>()
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const token = match[1] as MessageToken
    if ((MESSAGE_TOKENS as readonly string[]).includes(token)) found.add(token)
  }
  return [...found]
}

/**
 * Valor de cada token para um lead. `null` significa "nao tenho esse dado",
 * e e o que decide a elegibilidade do template.
 */
export function buildTokenValues(lead: MessageLead): Record<MessageToken, string | null> {
  return {
    nome: lead.name.trim() || null,
    nome_curto: shortName(lead.name) || null,
    bairro: lead.neighborhood?.trim() || null,
    categoria: lead.categoryLabel?.trim() || null,
    nota: lead.rating === null ? null : lead.rating.toFixed(1).replace('.', ','),
    avaliacoes: lead.reviewsCount === null ? null : String(lead.reviewsCount),
  }
}

/**
 * Um template so serve para um lead se todos os tokens que ele usa tem valor.
 *
 * E por isso que os textos que mencionam nota ou numero de avaliacoes nunca
 * caem num lead que nao tem esses dados -- em vez de gerar
 * "sua nota esta em null", o template simplesmente nao e sorteado.
 */
export function isTemplateEligible(body: string, lead: MessageLead): boolean {
  const values = buildTokenValues(lead)
  return tokensUsed(body).every((token) => values[token] !== null)
}

/** FNV-1a 32 bits: determinístico, bem distribuido, e cabe em tres linhas. */
function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/**
 * Atribui um template ao lead pelo hash do place_id.
 *
 * Hash e nao rodizio sequencial: distribui os cinco textos sem criar padrao
 * (dois vizinhos da mesma rua nao recebem a mesma mensagem so por terem sido
 * coletados em sequencia) e e estavel -- o mesmo lead sempre cai no mesmo
 * texto, entao a mensagem nao muda embaixo de mim entre dois carregamentos.
 */
export function pickTemplate<T extends MessageTemplate>(
  lead: MessageLead,
  templates: readonly T[],
): T | null {
  const eligible = templates.filter((t) => isTemplateEligible(t.body, lead))
  if (eligible.length === 0) return null
  return eligible[hashString(lead.placeId) % eligible.length]
}

/**
 * Substitui os tokens. Token sem valor vira string vazia e o espacamento e
 * normalizado depois -- defensivo, porque `pickTemplate` so devolve template
 * elegivel, mas a UI permite editar o texto na mao.
 */
export function renderMessage(body: string, lead: MessageLead): string {
  const values = buildTokenValues(lead)

  return body
    .replace(TOKEN_PATTERN, (full, token: string) => {
      if (!(MESSAGE_TOKENS as readonly string[]).includes(token)) return full
      return values[token as MessageToken] ?? ''
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

/**
 * Link wa.me com a mensagem pre-preenchida. Devolve `null` sem telefone --
 * a UI usa isso para desabilitar o botao em vez de abrir um link quebrado.
 */
export function waLink(phoneE164: string | null, text: string): string | null {
  if (!phoneE164) return null
  const digits = phoneE164.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Conveniencia: escolhe o template, renderiza e monta o link, numa tacada. */
export function buildApproach<T extends MessageTemplate>(
  lead: MessageLead,
  templates: readonly T[],
): { template: T | null; text: string; link: string | null } {
  const template = pickTemplate(lead, templates)
  if (!template) return { template: null, text: '', link: null }

  const text = renderMessage(template.body, lead)
  return { template, text, link: waLink(lead.phoneE164, text) }
}
