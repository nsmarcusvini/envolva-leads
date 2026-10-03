import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicEnv } from '@/lib/env'

/**
 * Cliente Supabase de servidor (Server Components, Server Actions e Route
 * Handlers).
 *
 * Usa a sessao do usuario, nao service-role: assim as policies de RLS valem
 * tambem no servidor, e esquecer um `where user_id = ...` deixa de ser uma
 * brecha. Nenhum lugar do app usa service-role.
 */
export async function createClient() {
  const env = getPublicEnv()
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component nao pode escrever cookie. Ignorar e o
            // comportamento correto: o middleware ja renovou a sessao antes
            // de a pagina renderizar.
          }
        },
      },
    },
  )
}

/**
 * Usuario autenticado ou `null`.
 *
 * Usa getUser() e nao getSession(): getSession() le o cookie sem validar a
 * assinatura no servidor de auth, entao nao serve para decidir acesso.
 */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
