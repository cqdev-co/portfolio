import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * OAuth callback handler for Supabase PKCE flow
 * 
 * This route receives the authorization code from the OAuth provider
 * and exchanges it for a session. The session tokens are stored in
 * HTTP-only cookies for secure server-side access.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const returnUrl = requestUrl.searchParams.get('returnUrl')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    console.error('[Auth] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${requestUrl.origin}?error=${error}`)
  }

  // Prepare redirect URL (return to original page or home)
  const redirectUrl = returnUrl 
    ? `${requestUrl.origin}${returnUrl}` 
    : requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookies) {
            cookies.forEach((cookie) => cookiesToSet.push(cookie))
          },
        },
      }
    )
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('[Auth] Code exchange failed:', error.message)
        return NextResponse.redirect(`${requestUrl.origin}?error=auth_error`)
      }
      
      // Create response with redirect and set auth cookies
      const response = NextResponse.redirect(redirectUrl)
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      
      return response
    } catch (err) {
      console.error('[Auth] Unexpected error:', err)
      return NextResponse.redirect(`${requestUrl.origin}?error=auth_error`)
    }
  }

  // No code provided - redirect to home
  return NextResponse.redirect(redirectUrl)
}
