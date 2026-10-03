import { describe, expect, it } from 'vitest'
import { parseBrazilPhone } from './phone'

describe('parseBrazilPhone', () => {
  it('reconhece celular e marca como provavel WhatsApp', () => {
    const phone = parseBrazilPhone('11 98765-4321')
    expect(phone.type).toBe('mobile')
    expect(phone.whatsappLikely).toBe(true)
    expect(phone.e164).toBe('+5511987654321')
    expect(phone.national).toBe('(11) 98765-4321')
  })

  it('reconhece telefone fixo e nao promete WhatsApp', () => {
    const phone = parseBrazilPhone('(11) 3256-7890')
    expect(phone.type).toBe('landline')
    expect(phone.whatsappLikely).toBe(false)
    expect(phone.e164).toBe('+551132567890')
  })

  it('aceita numero ja em E.164', () => {
    expect(parseBrazilPhone('+55 11 98765-4321').type).toBe('mobile')
  })

  it('trata 0800 como nao-WhatsApp', () => {
    // TOLL_FREE: valido, mas ninguem atende WhatsApp num 0800.
    const phone = parseBrazilPhone('0800 123 4567')
    expect(phone.type).toBe('unknown')
    expect(phone.whatsappLikely).toBe(false)
  })

  it('preserva o numero invalido sem inventar E.164', () => {
    // Sem DDD nao da para discar, mas o texto original pode servir na mao.
    const phone = parseBrazilPhone('98765-4321')
    expect(phone.raw).toBe('98765-4321')
    expect(phone.e164).toBeNull()
    expect(phone.type).toBe('unknown')
    expect(phone.whatsappLikely).toBe(false)
  })

  it('rejeita celular no formato antigo de 8 digitos', () => {
    expect(parseBrazilPhone('11 8765-4321').e164).toBeNull()
  })

  it('nao quebra com texto que nao e telefone', () => {
    const phone = parseBrazilPhone('nao tem')
    expect(phone.e164).toBeNull()
    expect(phone.type).toBe('unknown')
  })

  it.each([null, undefined, '', '   '])('trata ausencia de telefone (%s)', (input) => {
    const phone = parseBrazilPhone(input)
    expect(phone.raw).toBeNull()
    expect(phone.e164).toBeNull()
    expect(phone.whatsappLikely).toBe(false)
  })
})
