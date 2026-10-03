import { COST_PER_REQUEST_USD, MAX_PAGES_PER_TILE } from './constants'
import type { NormalizedPlace, PlacesAddressComponent, PlacesPlace } from './types'

/**
 * Normalizacao do retorno do Places e aritmetica de custo.
 *
 * Puro e sem `server-only` de proposito: isto precisa ser testavel sem rede e
 * legivel pela UI.
 */

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Primeiro componente de endereco que casa com algum dos tipos pedidos, na ordem dada. */
function findComponent(
  components: PlacesAddressComponent[] | undefined,
  wanted: string[],
): string | null {
  if (!components) return null
  for (const type of wanted) {
    const match = components.find((component) => component.types?.includes(type))
    const value = emptyToNull(match?.longText)
    if (value) return value
  }
  return null
}

/**
 * Normaliza um lugar da API. Devolve `null` se faltar id ou nome — sem esses
 * dois nao da para deduplicar nem abordar, entao o registro nao serve.
 */
export function normalizePlace(place: PlacesPlace): NormalizedPlace | null {
  const placeId = emptyToNull(place.id)
  const name = emptyToNull(place.displayName?.text)
  if (!placeId || !name) return null

  return {
    placeId,
    name,
    formattedAddress: emptyToNull(place.formattedAddress),
    // No Brasil o municipio vem em administrative_area_level_2; locality so as
    // vezes, e nem sempre com o nome que a pessoa usaria.
    city: findComponent(place.addressComponents, [
      'administrative_area_level_2',
      'locality',
      'postal_town',
    ]),
    neighborhood: findComponent(place.addressComponents, [
      'sublocality_level_1',
      'sublocality',
      'neighborhood',
    ]),
    lat: typeof place.location?.latitude === 'number' ? place.location.latitude : null,
    lng: typeof place.location?.longitude === 'number' ? place.location.longitude : null,
    phoneRaw: emptyToNull(place.nationalPhoneNumber) ?? emptyToNull(place.internationalPhoneNumber),
    website: emptyToNull(place.websiteUri),
    primaryType: emptyToNull(place.primaryType),
    primaryTypeLabel: emptyToNull(place.primaryTypeDisplayName?.text),
    types: place.types ?? [],
    // Ausente significa "nenhuma avaliacao ainda", nao zero estrelas — e a
    // diferenca importa no scoring, por isso vira null e nao 0.
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewsCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    businessStatus: emptyToNull(place.businessStatus),
    googleMapsUri: emptyToNull(place.googleMapsUri),
  }
}

/** Custo em US$ de um numero de requests. */
export function estimateCostUsd(requests: number): number {
  return Number((requests * COST_PER_REQUEST_USD).toFixed(4))
}

/**
 * Pior caso de requests de uma busca: todo tile indo as 3 paginas.
 *
 * A estimativa mostrada antes de rodar e o teto, nao a media — a coleta real
 * costuma custar menos, porque muito tile termina na primeira pagina. Melhor
 * o custo surpreender para baixo.
 */
export function estimateRequestsForTiles(tileCount: number): number {
  return tileCount * MAX_PAGES_PER_TILE
}

/** Combinacoes bairro x categoria de uma busca. */
export function countTiles(neighborhoods: readonly string[], categories: readonly string[]): number {
  return neighborhoods.length * categories.length
}

/** O textQuery literal enviado a API. Guardado no tile para reproduzir a consulta. */
export function buildTextQuery(category: string, neighborhood: string, city: string): string {
  return `${category} em ${neighborhood}, ${city}`
}
