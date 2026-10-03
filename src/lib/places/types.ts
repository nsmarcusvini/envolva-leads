/**
 * Tipos do Google Places API (New), endpoint places:searchText.
 *
 * Todos os campos sao opcionais: a API so devolve o que o field mask pede, e
 * ainda assim omite o que o lugar nao tem (comercio sem telefone simplesmente
 * nao traz a chave).
 */

export interface PlacesLocalizedText {
  text?: string
  languageCode?: string
}

export interface PlacesAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
  languageCode?: string
}

export interface PlacesLatLng {
  latitude?: number
  longitude?: number
}

export interface PlacesPlace {
  id?: string
  displayName?: PlacesLocalizedText
  formattedAddress?: string
  addressComponents?: PlacesAddressComponent[]
  location?: PlacesLatLng
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  primaryTypeDisplayName?: PlacesLocalizedText
  types?: string[]
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY */
  businessStatus?: string
  googleMapsUri?: string
}

export interface PlacesSearchTextResponse {
  places?: PlacesPlace[]
  nextPageToken?: string
}

export interface PlacesErrorBody {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

/**
 * Lugar depois de normalizado: chaves achatadas, strings vazias viradas em
 * null, bairro e cidade extraidos de addressComponents. E isso que vira lead.
 */
export interface NormalizedPlace {
  placeId: string
  name: string
  formattedAddress: string | null
  city: string | null
  neighborhood: string | null
  lat: number | null
  lng: number | null
  phoneRaw: string | null
  website: string | null
  primaryType: string | null
  primaryTypeLabel: string | null
  types: string[]
  rating: number | null
  reviewsCount: number | null
  businessStatus: string | null
  googleMapsUri: string | null
}
