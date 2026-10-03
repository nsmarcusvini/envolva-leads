/**
 * Constantes do Google Places API (New).
 *
 * Arquivo separado do cliente de proposito: o cliente e `server-only` (carrega
 * a chave da API), mas a estimativa de custo e os limites precisam ser lidos
 * tambem pela UI, que roda no browser.
 */

/**
 * Field mask da coleta.
 *
 * Pedir telefone, site, nota e numero de avaliacoes aqui coloca a chamada no
 * SKU "Text Search Enterprise". Parece caro, mas a cobranca do Places (New) e
 * POR REQUEST, nao por lugar devolvido: um request traz ate 20 comercios ja
 * completos. Buscar os mesmos campos via Place Details, um por lead, custaria
 * ordens de magnitude mais — e e por isso que o Place Details nao participa da
 * coleta.
 *
 * addressComponents entra sem custo adicional (faixa Pro, ja coberta pela
 * Enterprise) e e o que da o bairro de verdade, em vez de assumir o bairro da
 * consulta.
 */
export const PLACES_FIELD_MASK = [
  'nextPageToken',
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.businessStatus',
  'places.googleMapsUri',
].join(',')

/** US$ por request no SKU Text Search Enterprise (US$ 35,00 / 1.000). */
export const COST_PER_REQUEST_USD = 0.035

/** Cota mensal gratuita de requests Enterprise, para o aviso de orcamento. */
export const FREE_ENTERPRISE_REQUESTS_PER_MONTH = 1_000

/** Teto da API: 20 por pagina, 3 paginas, 60 resultados por consulta. */
export const MAX_PAGE_SIZE = 20
export const MAX_PAGES_PER_TILE = 3
export const MAX_RESULTS_PER_TILE = MAX_PAGE_SIZE * MAX_PAGES_PER_TILE
