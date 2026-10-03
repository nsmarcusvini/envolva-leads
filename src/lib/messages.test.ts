import { describe, expect, it } from 'vitest'
import {
  buildApproach,
  isTemplateEligible,
  pickTemplate,
  renderMessage,
  shortName,
  tokensUsed,
  waLink,
  type MessageLead,
} from './messages'

function lead(overrides: Partial<MessageLead> = {}): MessageLead {
  return {
    placeId: 'ChIJaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Pizzaria Dom Pedro',
    neighborhood: 'Moema',
    categoryLabel: 'pizzaria',
    rating: 3.4,
    reviewsCount: 12,
    phoneE164: '+5511987654321',
    ...overrides,
  }
}

describe('shortName', () => {
  it.each([
    ['Bar do Ze', 'Ze'],
    ['Pizzaria Dom Pedro', 'Dom Pedro'],
    ['Padaria Estrela Guia', 'Estrela Guia'],
    ['Mercadinho Sao Joao', 'Sao Joao'],
    ['Oficina do Marcao', 'Marcao'],
    ['Barbearia Navalha', 'Navalha'],
  ])('tira o prefixo generico de %s', (input, expected) => {
    expect(shortName(input)).toBe(expected)
  })

  it('devolve o nome inteiro quando nao sobraria nada', () => {
    expect(shortName('Padaria')).toBe('Padaria')
  })

  it('reconhece prefixo generico mesmo acentuado', () => {
    expect(shortName('Ótica Visão Clara')).toBe('Visão Clara')
  })

  it('nao mexe em nome que nao comeca com palavra generica', () => {
    expect(shortName('Seu Bento Comida Caseira')).toBe('Seu Bento Comida Caseira')
  })
})

describe('tokensUsed', () => {
  it('encontra os tokens do corpo', () => {
    expect(tokensUsed('Oi {{nome}}, vi que tem {{avaliacoes}} avaliacoes').sort()).toEqual([
      'avaliacoes',
      'nome',
    ])
  })

  it('aceita espacos dentro das chaves', () => {
    expect(tokensUsed('{{ bairro }}')).toEqual(['bairro'])
  })

  it('ignora token desconhecido', () => {
    expect(tokensUsed('{{inexistente}}')).toEqual([])
  })

  it('nao duplica token repetido', () => {
    expect(tokensUsed('{{nome}} {{nome}}')).toEqual(['nome'])
  })
})

describe('isTemplateEligible', () => {
  it('rejeita template que pede nota de um lead sem nota', () => {
    expect(isTemplateEligible('nota {{nota}}', lead({ rating: null }))).toBe(false)
  })

  it('rejeita template que pede bairro de um lead sem bairro', () => {
    expect(isTemplateEligible('ai no {{bairro}}', lead({ neighborhood: null }))).toBe(false)
  })

  it('aceita template sem token nenhum para qualquer lead', () => {
    expect(isTemplateEligible('Oi, tudo bem?', lead({ rating: null, neighborhood: null }))).toBe(
      true,
    )
  })

  it('aceita quando todos os tokens tem valor', () => {
    expect(isTemplateEligible('{{nome}} / {{nota}} / {{avaliacoes}}', lead())).toBe(true)
  })

  it('trata zero avaliacoes como valor presente, nao como ausencia', () => {
    // 0 e um dado legitimo e o argumento de venda mais forte que existe.
    expect(isTemplateEligible('{{avaliacoes}}', lead({ reviewsCount: 0 }))).toBe(true)
  })
})

describe('pickTemplate', () => {
  const templates = [1, 2, 3, 4, 5].map((n) => ({
    id: `t${n}`,
    name: `Variacao ${n}`,
    body: `Texto ${n} para {{nome}}`,
  }))

  it('e estavel: o mesmo lead cai sempre no mesmo texto', () => {
    const first = pickTemplate(lead(), templates)
    for (let i = 0; i < 20; i += 1) {
      expect(pickTemplate(lead(), templates)?.id).toBe(first?.id)
    }
  })

  it('distribui entre todas as variacoes', () => {
    const used = new Set<string>()
    for (let i = 0; i < 400; i += 1) {
      used.add(pickTemplate(lead({ placeId: `place-${i}` }), templates)!.id)
    }
    expect(used.size).toBe(templates.length)
  })

  it('nao cria padrao sequencial entre leads coletados em sequencia', () => {
    // Rodizio sequencial daria 5 ids sempre diferentes em sequencia; hash nao.
    const sequence = Array.from({ length: 10 }, (_, i) =>
      pickTemplate(lead({ placeId: `seq-${i}` }), templates)!.id,
    )
    expect(new Set(sequence).size).toBeLessThan(sequence.length)
  })

  it('so escolhe entre os templates elegiveis', () => {
    const mixed = [
      { id: 'pede-nota', name: 'A', body: 'nota {{nota}}' },
      { id: 'neutro', name: 'B', body: 'Oi!' },
    ]
    for (let i = 0; i < 30; i += 1) {
      const picked = pickTemplate(lead({ placeId: `p-${i}`, rating: null }), mixed)
      expect(picked?.id).toBe('neutro')
    }
  })

  it('devolve null quando nenhum template serve', () => {
    expect(pickTemplate(lead({ rating: null }), [{ id: 'x', name: 'X', body: '{{nota}}' }])).toBeNull()
  })

  it('devolve null com lista vazia', () => {
    expect(pickTemplate(lead(), [])).toBeNull()
  })
})

describe('renderMessage', () => {
  it('substitui todos os tokens', () => {
    const text = renderMessage(
      'Oi {{nome_curto}}, vi o {{nome}} no {{bairro}}: nota {{nota}}, {{avaliacoes}} avaliacoes de {{categoria}}',
      lead(),
    )
    expect(text).toBe(
      'Oi Dom Pedro, vi o Pizzaria Dom Pedro no Moema: nota 3,4, 12 avaliacoes de pizzaria',
    )
  })

  it('formata a nota com virgula e uma casa', () => {
    expect(renderMessage('{{nota}}', lead({ rating: 4 }))).toBe('4,0')
  })

  it('deixa token desconhecido intacto em vez de apagar', () => {
    expect(renderMessage('{{nao_existe}}', lead())).toBe('{{nao_existe}}')
  })

  it('nao deixa espaco duplo ao cair um token vazio', () => {
    // Defensivo: a UI permite editar o texto na mao e reintroduzir um token.
    expect(renderMessage('antes {{bairro}} depois', lead({ neighborhood: null }))).toBe(
      'antes depois',
    )
  })

  it('preserva as quebras de linha do template', () => {
    expect(renderMessage('linha 1\n\nlinha 2', lead())).toBe('linha 1\n\nlinha 2')
  })
})

describe('waLink', () => {
  it('monta o link com o texto codificado', () => {
    expect(waLink('+5511987654321', 'oi, tudo bem?')).toBe(
      'https://wa.me/5511987654321?text=oi%2C%20tudo%20bem%3F',
    )
  })

  it('codifica quebra de linha e acento', () => {
    const link = waLink('+5511987654321', 'linha 1\nnão')
    expect(link).toContain('%0A')
    expect(link).toContain('n%C3%A3o')
  })

  it('devolve null sem telefone, para a UI desabilitar o botao', () => {
    expect(waLink(null, 'oi')).toBeNull()
    expect(waLink('', 'oi')).toBeNull()
  })
})

describe('buildApproach', () => {
  const templates = [{ id: 't1', name: 'Unica', body: 'Oi {{nome_curto}}, tudo bem?' }]

  it('entrega texto e link prontos', () => {
    const result = buildApproach(lead(), templates)
    expect(result.template?.id).toBe('t1')
    expect(result.text).toBe('Oi Dom Pedro, tudo bem?')
    expect(result.link).toBe('https://wa.me/5511987654321?text=Oi%20Dom%20Pedro%2C%20tudo%20bem%3F')
  })

  it('entrega texto sem link quando o lead nao tem telefone', () => {
    const result = buildApproach(lead({ phoneE164: null }), templates)
    expect(result.text).toBe('Oi Dom Pedro, tudo bem?')
    expect(result.link).toBeNull()
  })

  it('devolve vazio quando nenhum template serve', () => {
    const result = buildApproach(lead({ rating: null }), [
      { id: 'x', name: 'X', body: '{{nota}}' },
    ])
    expect(result.template).toBeNull()
    expect(result.text).toBe('')
    expect(result.link).toBeNull()
  })
})
