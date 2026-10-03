import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnv } from '@/lib/env'

/**
 * Cliente Supabase do browser. Usa a publishable/anon key, que e publica por
 * design — toda a protecao real vem das policies de RLS.
 */
export function createClient() {
  const env = getPublicEnv()
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
