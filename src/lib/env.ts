import { z } from 'zod'

/**
 * Validacao de variaveis de ambiente.
 *
 * A validacao e preguicosa de proposito: roda na primeira chamada, nao no load
 * do modulo. Validar no load faria `next build` quebrar sempre que uma chave
 * ainda nao estivesse configurada, inclusive em partes do app que nem usam
 * aquela chave.
 */

const serverSchema = z.object({
  /**
   * Chave do Google Places API (New). NUNCA prefixada com NEXT_PUBLIC_:
   * ela nao pode vazar para o browser.
   */
  GOOGLE_PLACES_API_KEY: z.string().min(10, 'GOOGLE_PLACES_API_KEY ausente ou invalida'),
})

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL'),
  /**
   * Aceita a publishable key nova (sb_publishable_...) ou a anon key legada
   * (JWT). Projetos criados recentemente no Supabase entregam a primeira.
   */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type PublicEnv = z.infer<typeof publicSchema>

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
}

let serverEnvCache: ServerEnv | null = null

/** Env de servidor. Lanca com mensagem acionavel se algo faltar. */
export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Variaveis de ambiente de servidor invalidas:\n${formatIssues(parsed.error)}\n` +
        'Confira o .env.local (use .env.example como referencia).',
    )
  }

  serverEnvCache = parsed.data
  return serverEnvCache
}

let publicEnvCache: PublicEnv | null = null

/**
 * Env publica. Os valores sao lidos explicitamente em vez de via
 * `process.env` dinamico porque o Next so inlina `NEXT_PUBLIC_*` quando a
 * referencia e literal no codigo.
 */
export function getPublicEnv(): PublicEnv {
  if (publicEnvCache) return publicEnvCache

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  if (!parsed.success) {
    throw new Error(
      `Variaveis de ambiente publicas invalidas:\n${formatIssues(parsed.error)}\n` +
        'Confira o .env.local (use .env.example como referencia).',
    )
  }

  publicEnvCache = parsed.data
  return publicEnvCache
}
