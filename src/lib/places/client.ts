import 'server-only'

import { getServerEnv } from '@/lib/env'
import { MAX_PAGE_SIZE, PLACES_FIELD_MASK } from './constants'
import { normalizePlace } from './normalize'
import type { NormalizedPlace, PlacesErrorBody, PlacesSearchTextResponse } from './types'

/**
 * Cliente do Google Places API (New) — endpoint places:searchText.
 *
 * COMPLIANCE: API oficial, nada de scraping do Maps.
 *
 * `server-only` no topo: a chave do Google nao pode chegar ao browser, e
 * importar este modulo de um componente de cliente passa a ser erro de build
 * em vez de vazamento silencioso.
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly apiStatus: string | null,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'PlacesApiError'
  }
}

export interface SearchTextParams {
  textQuery: string
  /**
   * Token da pagina anterior.
   *
   * ATENCAO: a API exige que todo parametro fora de pageToken/pageSize seja
   * identico ao do request que gerou o token, senao devolve INVALID_ARGUMENT.
   * Como o corpo e montado deterministicamente a partir destes params, basta
   * quem chama repassar o mesmo textQuery/languageCode/regionCode — e o
   * textQuery fica salvo no tile exatamente para isso.
   */
  pageToken?: string
  languageCode?: string
  regionCode?: string
  pageSize?: number
}

export interface SearchTextResult {
  places: NormalizedPlace[]
  nextPageToken: string | null
  /**
   * Requests que chegaram ao Google nesta chamada, incluindo tentativas que
   * voltaram erro. Conta por cima de proposito: para um teto de orcamento,
   * subestimar custo e pior que superestimar.
   */
  requestCount: number
}

const RETRY_DELAYS_MS = [400, 1200]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Busca uma pagina de resultados. Uma chamada = uma pagina = um request
 * faturavel.
 *
 * A paginacao fica deliberadamente com quem chama (um "step" por pagina, com
 * o estado no tile): assim a coleta e retomavel se o browser fechar, e nenhum
 * request unico corre risco de estourar o timeout de serverless.
 */
export async function searchText(params: SearchTextParams): Promise<SearchTextResult> {
  const { GOOGLE_PLACES_API_KEY } = getServerEnv()

  const payload: Record<string, unknown> = {
    textQuery: params.textQuery,
    languageCode: params.languageCode ?? 'pt-BR',
    regionCode: params.regionCode ?? 'BR',
    pageSize: Math.min(params.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  }
  if (params.pageToken) payload.pageToken = params.pageToken

  const body = JSON.stringify(payload)

  let requestCount = 0
  let lastError: PlacesApiError | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body,
      cache: 'no-store',
    })

    requestCount += 1

    if (response.ok) {
      const data = (await response.json()) as PlacesSearchTextResponse
      return {
        places: (data.places ?? []).flatMap((place) => {
          const normalized = normalizePlace(place)
          return normalized ? [normalized] : []
        }),
        nextPageToken: data.nextPageToken ?? null,
        requestCount,
      }
    }

    const errorBody = (await response.json().catch(() => ({}))) as PlacesErrorBody
    // 429 e 5xx valem nova tentativa; 400/403 sao erro de configuracao
    // (field mask invalido, chave sem a API habilitada) e insistir nao resolve.
    const retryable = response.status === 429 || response.status >= 500

    lastError = new PlacesApiError(
      errorBody.error?.message ?? `Places API devolveu HTTP ${response.status}`,
      response.status,
      errorBody.error?.status ?? null,
      retryable,
    )

    if (!retryable || attempt === RETRY_DELAYS_MS.length) break
    await sleep(RETRY_DELAYS_MS[attempt])
  }

  throw lastError ?? new PlacesApiError('Falha desconhecida na Places API', 0, null, false)
}
