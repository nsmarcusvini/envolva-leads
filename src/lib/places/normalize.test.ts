import { describe, expect, it } from 'vitest'
import {
  buildTextQuery,
  countTiles,
  estimateCostUsd,
  estimateRequestsForTiles,
  normalizePlace,
} from './normalize'
import type { PlacesPlace } from './types'

/** Retorno tipico de um comercio brasileiro no places:searchText. */
const PIZZARIA: PlacesPlace = {
  id: 'ChIJ0WGkg4FEzpQRrlsz_whLqZs',
  displayName: { text: 'Pizzaria Dom Pedro', languageCode: 'pt-BR' },
  formattedAddress: 'R. Gaivota, 1200 - Moema, São Paulo - SP, 04522-032, Brasil',
  addressComponents: [
    { longText: '1200', shortText: '1200', types: ['street_number'] },
    { longText: 'Rua Gaivota', shortText: 'R. Gaivota', types: ['route'] },
    {
      longText: 'Moema',
      shortText: 'Moema',
      types: ['sublocality_level_1', 'sublocality', 'political'],
    },
    {
      longText: 'São Paulo',
      shortText: 'São Paulo',
      types: ['administrative_area_level_2', 'political'],
    },
    { longText: 'São Paulo', shortText: 'SP', types: ['administrative_area_level_1', 'political'] },
    { longText: 'Brasil', shortText: 'BR', types: ['country', 'political'] },
  ],
  location: { latitude: -23.6024, longitude: -46.6687 },
  nationalPhoneNumber: '(11) 98765-4321',
  websiteUri: 'https://pizzariadompedro.com.br',
  rating: 3.4,
  userRatingCount: 12,
  primaryType: 'pizza_restaurant',
  primaryTypeDisplayName: { text: 'Pizzaria', languageCode: 'pt-BR' },
  types: ['pizza_restaurant', 'restaurant', 'food', 'point_of_interest'],
  businessStatus: 'OPERATIONAL',
  googleMapsUri: 'https://maps.google.com/?cid=123',
}

describe('normalizePlace', () => {
  it('achata o retorno da API no formato de lead', () => {
    const place = normalizePlace(PIZZARIA)!
    expect(place.placeId).toBe('ChIJ0WGkg4FEzpQRrlsz_whLqZs')
    expect(place.name).toBe('Pizzaria Dom Pedro')
    expect(place.phoneRaw).toBe('(11) 98765-4321')
    expect(place.rating).toBe(3.4)
    expect(place.reviewsCount).toBe(12)
    expect(place.primaryTypeLabel).toBe('Pizzaria')
    expect(place.lat).toBe(-23.6024)
  })

  it('extrai o bairro de sublocality_level_1, nao do texto da consulta', () => {
    expect(normalizePlace(PIZZARIA)!.neighborhood).toBe('Moema')
  })

  it('extrai o municipio de administrative_area_level_2, como vem no Brasil', () => {
    expect(normalizePlace(PIZZARIA)!.city).toBe('São Paulo')
  })

  it('cai para neighborhood quando nao ha sublocality', () => {
    const place = normalizePlace({
      ...PIZZARIA,
      addressComponents: [
        { longText: 'Vila Nova', types: ['neighborhood', 'political'] },
        { longText: 'Campinas', types: ['locality', 'political'] },
      ],
    })!
    expect(place.neighborhood).toBe('Vila Nova')
    expect(place.city).toBe('Campinas')
  })

  it('devolve null em bairro e cidade quando a API nao manda componentes', () => {
    const place = normalizePlace({ ...PIZZARIA, addressComponents: undefined })!
    expect(place.neighborhood).toBeNull()
    expect(place.city).toBeNull()
  })

  it('distingue "sem avaliacao" de "zero estrelas"', () => {
    // A API omite rating e userRatingCount em comercio nunca avaliado. Virar
    // null e nao 0 e o que deixa o scoring tratar isso como oportunidade
    // incerta em vez de nota pessima.
    const place = normalizePlace({
      ...PIZZARIA,
      rating: undefined,
      userRatingCount: undefined,
    })!
    expect(place.rating).toBeNull()
    expect(place.reviewsCount).toBeNull()
  })

  it('preserva zero avaliacoes como zero', () => {
    const place = normalizePlace({ ...PIZZARIA, userRatingCount: 0, rating: undefined })!
    expect(place.reviewsCount).toBe(0)
  })

  it('cai para o telefone internacional quando falta o nacional', () => {
    const place = normalizePlace({
      ...PIZZARIA,
      nationalPhoneNumber: undefined,
      internationalPhoneNumber: '+55 11 98765-4321',
    })!
    expect(place.phoneRaw).toBe('+55 11 98765-4321')
  })

  it('transforma string vazia em null', () => {
    const place = normalizePlace({
      ...PIZZARIA,
      websiteUri: '   ',
      formattedAddress: '',
    })!
    expect(place.website).toBeNull()
    expect(place.formattedAddress).toBeNull()
  })

  it('descarta lugar sem id ou sem nome', () => {
    expect(normalizePlace({ ...PIZZARIA, id: undefined })).toBeNull()
    expect(normalizePlace({ ...PIZZARIA, displayName: undefined })).toBeNull()
    expect(normalizePlace({})).toBeNull()
  })

  it('nao quebra com resposta minima', () => {
    const place = normalizePlace({ id: 'abc', displayName: { text: 'Bar' } })!
    expect(place.name).toBe('Bar')
    expect(place.types).toEqual([])
    expect(place.businessStatus).toBeNull()
  })
})

describe('aritmetica de custo', () => {
  it('conta um tile por combinacao bairro x categoria', () => {
    expect(countTiles(['Moema', 'Pinheiros', 'Lapa'], ['pizzaria', 'barbearia'])).toBe(6)
  })

  it('estima o teto de requests em 3 paginas por tile', () => {
    expect(estimateRequestsForTiles(6)).toBe(18)
  })

  it('cobra US$ 0,035 por request', () => {
    expect(estimateCostUsd(1)).toBe(0.035)
    expect(estimateCostUsd(1000)).toBe(35)
  })

  it('estima a busca inteira: 6 tiles custam no maximo US$ 0,63', () => {
    const tiles = countTiles(['Moema', 'Pinheiros', 'Lapa'], ['pizzaria', 'barbearia'])
    expect(estimateCostUsd(estimateRequestsForTiles(tiles))).toBe(0.63)
  })
})

describe('buildTextQuery', () => {
  it('monta a consulta no formato enviado a API', () => {
    expect(buildTextQuery('pizzaria', 'Moema', 'São Paulo')).toBe('pizzaria em Moema, São Paulo')
  })
})
