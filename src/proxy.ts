import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  /**
   * Tudo, menos assets estaticos e imagens — cada passagem pelo proxy
   * faz uma chamada de validacao de sessao, e nao faz sentido gastar isso
   * servindo um .svg.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
