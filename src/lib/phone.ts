/**
 * Classificacao de telefone brasileiro: celular (provavel WhatsApp) x fixo.
 *
 * IMPORTANTE: o import tem que ser de `libphonenumber-js/max`. O entry point
 * padrao do pacote usa metadata "min", que NAO carrega os padroes de tipo --
 * `getType()` devolve `undefined` para todo numero e a classificacao falha em
 * silencio, marcando tudo como 'unknown'.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

export type PhoneType = 'mobile' | 'landline' | 'unknown'

export interface ParsedPhone {
  /** o que o Google devolveu, preservado como veio */
  raw: string | null
  /** formato +55DDNNNNNNNNN, usado no link wa.me e no dedup de opt-out */
  e164: string | null
  /** (11) 98765-4321 — o que aparece na tela */
  national: string | null
  type: PhoneType
  /**
   * "likely" e nao "has": celular e probabilidade de WhatsApp, nao prova.
   * O nome do campo existe para nao deixar o resto do codigo fingir certeza
   * que o dado nao tem.
   */
  whatsappLikely: boolean
}

const NO_PHONE: ParsedPhone = {
  raw: null,
  e164: null,
  national: null,
  type: 'unknown',
  whatsappLikely: false,
}

/**
 * Fallback pelo plano de numeracao brasileiro, para quando o libphonenumber
 * devolve FIXED_LINE_OR_MOBILE ou nao sabe o tipo.
 *
 * Celular: 11 digitos (DD + 9 + 8 digitos), o nono digito e sempre 9.
 * Fixo:    10 digitos (DD + 8 digitos), comecando em 2-5.
 */
function guessTypeFromBrazilPlan(nationalNumber: string): PhoneType {
  if (nationalNumber.length === 11 && nationalNumber.startsWith('9', 2)) return 'mobile'
  if (nationalNumber.length === 10 && /^[2-5]/.test(nationalNumber.slice(2))) return 'landline'
  return 'unknown'
}

export function parseBrazilPhone(input: string | null | undefined): ParsedPhone {
  const raw = input?.trim()
  if (!raw) return NO_PHONE

  const parsed = parsePhoneNumberFromString(raw, 'BR')
  if (!parsed?.isValid()) {
    // Guarda o original: numero invalido ainda pode ser discado na mao.
    return { ...NO_PHONE, raw }
  }

  const base = {
    raw,
    e164: parsed.number,
    national: parsed.formatNational(),
  }

  switch (parsed.getType()) {
    case 'MOBILE':
      return { ...base, type: 'mobile', whatsappLikely: true }

    case 'FIXED_LINE':
      return { ...base, type: 'landline', whatsappLikely: false }

    case 'FIXED_LINE_OR_MOBILE': {
      // Ambiguo para a biblioteca, mas o plano BR costuma resolver.
      const guessed = guessTypeFromBrazilPlan(parsed.nationalNumber)
      return {
        ...base,
        type: guessed,
        // Mesmo sem resolver, vale a tentativa: pode ser WhatsApp.
        whatsappLikely: guessed !== 'landline',
      }
    }

    default: {
      // TOLL_FREE, PERSONAL_NUMBER, undefined... cai no plano BR e, se nem
      // ele resolver, assume que nao da para contar com WhatsApp.
      const guessed = guessTypeFromBrazilPlan(parsed.nationalNumber)
      return { ...base, type: guessed, whatsappLikely: guessed === 'mobile' }
    }
  }
}
