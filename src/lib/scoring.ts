/**
 * Lead scoring: quanto um comercio precisa de ajuda com presenca no Google
 * E quanto da para alcancar ele.
 *
 * 0-100, quatro componentes. Os dois eixos que o briefing define como
 * prioritarios -- nota baixa e poucas avaliacoes -- somam 75 dos 100 pontos.
 *
 * Cada componente devolve tambem uma justificativa legivel. A UI mostra essas
 * justificativas junto do numero de proposito: score sem motivo visivel e
 * score em que nao se confia na hora de decidir a quem ligar.
 */
import type { PhoneType } from './phone'

export type LeadTier = 'A' | 'B' | 'C'

export interface ScoreInput {
  rating: number | null
  reviewsCount: number | null
  phoneType: PhoneType
  whatsappLikely: boolean
  hasWebsite: boolean
  /** businessStatus do Places: OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY */
  businessStatus: string | null
}

export interface ScoreResult {
  score: number
  tier: LeadTier
  reasons: string[]
  /** comercio fechado: nao vale gastar abordagem */
  autoDiscard: boolean
}

export const TIER_A_MIN = 70
export const TIER_B_MIN = 45

/** Gap de nota — 0 a 40 pontos. */
function scoreRating(rating: number | null): [number, string] {
  if (rating === null) {
    // Sem nota e oportunidade real, mas incerta: pode ser cadastro novo ou
    // abandonado. Pontua forte, nao maximo.
    return [26, 'sem nota no Google ainda']
  }
  const nota = rating.toFixed(1).replace('.', ',')
  if (rating <= 3.4) return [40, `nota ${nota}, bem abaixo da media`]
  if (rating <= 3.9) return [34, `nota ${nota}, abaixo da media`]
  if (rating <= 4.2) return [24, `nota ${nota}, tem espaco para subir`]
  if (rating <= 4.5) return [12, `nota ${nota}, razoavel`]
  return [2, `nota ${nota}, ja esta otima`]
}

/** Volume de avaliacoes — 0 a 35 pontos. */
function scoreReviews(reviewsCount: number | null): [number, string] {
  if (reviewsCount === null || reviewsCount === 0) {
    return [35, 'nenhuma avaliacao']
  }
  if (reviewsCount <= 5) return [32, `so ${reviewsCount} avaliacoes`]
  if (reviewsCount <= 20) return [26, `apenas ${reviewsCount} avaliacoes`]
  if (reviewsCount <= 60) return [16, `${reviewsCount} avaliacoes, ainda poucas`]
  if (reviewsCount <= 200) return [7, `${reviewsCount} avaliacoes`]
  return [0, `${reviewsCount} avaliacoes, volume alto`]
}

/** Alcance — 0 a 15 pontos. De nada serve o lead perfeito sem como falar com ele. */
function scoreReach(phoneType: PhoneType, whatsappLikely: boolean): [number, string] {
  if (phoneType === 'mobile') return [15, 'celular, provavel WhatsApp']
  if (phoneType === 'landline') return [6, 'telefone fixo']
  if (whatsappLikely) return [10, 'telefone pode ser WhatsApp']
  return [0, 'sem telefone publicado']
}

/** Presenca digital — 0 a 10 pontos. */
function scorePresence(hasWebsite: boolean): [number, string] {
  return hasWebsite ? [3, 'tem site'] : [10, 'sem site']
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const status = input.businessStatus?.toUpperCase() ?? null

  // Fechado nao entra no funil, independente do resto.
  if (status !== null && status !== 'OPERATIONAL') {
    const label =
      status === 'CLOSED_PERMANENTLY'
        ? 'fechado permanentemente'
        : status === 'CLOSED_TEMPORARILY'
          ? 'fechado temporariamente'
          : `situacao ${status}`
    return { score: 0, tier: 'C', reasons: [label], autoDiscard: true }
  }

  const parts = [
    scoreRating(input.rating),
    scoreReviews(input.reviewsCount),
    scoreReach(input.phoneType, input.whatsappLikely),
    scorePresence(input.hasWebsite),
  ]

  const raw = parts.reduce((sum, [points]) => sum + points, 0)
  const score = Math.max(0, Math.min(100, raw))

  return {
    score,
    tier: score >= TIER_A_MIN ? 'A' : score >= TIER_B_MIN ? 'B' : 'C',
    reasons: parts.map(([, reason]) => reason),
    autoDiscard: false,
  }
}
