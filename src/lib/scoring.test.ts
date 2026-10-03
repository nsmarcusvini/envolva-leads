import { describe, expect, it } from 'vitest'
import { scoreLead, type ScoreInput } from './scoring'

/** Lead neutro; cada teste muda so o que esta aferindo. */
function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    rating: 4.4,
    reviewsCount: 150,
    phoneType: 'landline',
    whatsappLikely: false,
    hasWebsite: true,
    businessStatus: 'OPERATIONAL',
    ...overrides,
  }
}

describe('scoreLead', () => {
  it('da a nota maxima ao lead ideal: nota baixa, sem avaliacao, celular, sem site', () => {
    const result = scoreLead(
      input({
        rating: 2.9,
        reviewsCount: 0,
        phoneType: 'mobile',
        whatsappLikely: true,
        hasWebsite: false,
      }),
    )
    expect(result.score).toBe(100)
    expect(result.tier).toBe('A')
    expect(result.autoDiscard).toBe(false)
  })

  it('rebaixa quem ja esta bem resolvido no Google', () => {
    const result = scoreLead(input({ rating: 4.9, reviewsCount: 2000 }))
    // 2 (nota otima) + 0 (volume alto) + 6 (fixo) + 3 (tem site)
    expect(result.score).toBe(11)
    expect(result.tier).toBe('C')
  })

  it('descarta comercio fechado sem olhar o resto', () => {
    const result = scoreLead(
      input({
        businessStatus: 'CLOSED_PERMANENTLY',
        rating: 2.0,
        reviewsCount: 0,
        phoneType: 'mobile',
        hasWebsite: false,
      }),
    )
    expect(result.autoDiscard).toBe(true)
    expect(result.score).toBe(0)
    expect(result.reasons).toEqual(['fechado permanentemente'])
  })

  it('tambem descarta fechado temporariamente', () => {
    expect(scoreLead(input({ businessStatus: 'CLOSED_TEMPORARILY' })).autoDiscard).toBe(true)
  })

  it('aceita businessStatus ausente como operacional', () => {
    expect(scoreLead(input({ businessStatus: null })).autoDiscard).toBe(false)
  })

  it('pontua "sem nota" forte, mas abaixo de nota comprovadamente baixa', () => {
    const semNota = scoreLead(input({ rating: null })).score
    const notaBaixa = scoreLead(input({ rating: 3.0 })).score
    expect(semNota).toBeLessThan(notaBaixa)
    expect(semNota).toBeGreaterThan(scoreLead(input({ rating: 4.4 })).score)
  })

  it('trata zero e null avaliacoes como a mesma oportunidade', () => {
    expect(scoreLead(input({ reviewsCount: 0 })).score).toBe(
      scoreLead(input({ reviewsCount: null })).score,
    )
  })

  it('penaliza quem nao tem telefone publicado', () => {
    const semTelefone = scoreLead(input({ phoneType: 'unknown', whatsappLikely: false }))
    const comCelular = scoreLead(input({ phoneType: 'mobile', whatsappLikely: true }))
    expect(comCelular.score - semTelefone.score).toBe(15)
    expect(semTelefone.reasons).toContain('sem telefone publicado')
  })

  it('da credito parcial a telefone ambiguo que pode ser WhatsApp', () => {
    const ambiguo = scoreLead(input({ phoneType: 'unknown', whatsappLikely: true })).score
    const fixo = scoreLead(input({ phoneType: 'landline' })).score
    const celular = scoreLead(input({ phoneType: 'mobile', whatsappLikely: true })).score
    expect(ambiguo).toBeGreaterThan(fixo)
    expect(ambiguo).toBeLessThan(celular)
  })

  it('sempre devolve uma justificativa por componente', () => {
    const result = scoreLead(input())
    expect(result.reasons).toHaveLength(4)
    expect(result.reasons.every((r) => r.length > 0)).toBe(true)
  })

  it('formata a nota com virgula na justificativa', () => {
    expect(scoreLead(input({ rating: 3.2 })).reasons[0]).toContain('nota 3,2')
  })

  it('mantem o score dentro de 0 a 100 em qualquer combinacao', () => {
    const ratings = [null, 0, 2.9, 3.5, 4.1, 4.4, 5]
    const reviews = [null, 0, 3, 15, 50, 120, 5000]
    for (const rating of ratings) {
      for (const reviewsCount of reviews) {
        for (const phoneType of ['mobile', 'landline', 'unknown'] as const) {
          for (const hasWebsite of [true, false]) {
            const { score, tier } = scoreLead(
              input({ rating, reviewsCount, phoneType, hasWebsite, whatsappLikely: false }),
            )
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(100)
            expect(['A', 'B', 'C']).toContain(tier)
          }
        }
      }
    }
  })
})
