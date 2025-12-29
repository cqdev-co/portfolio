import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const returnUrl = requestUrl.searchParams.get('returnUrl')

  // Prepare redirect URL
  const redirectUrl = returnUrl 
    ? `${requestUrl.origin}${returnUrl}` 
    : requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    
    // Store cookies to set on the response
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
            // Collect cookies to set on response later
            cookies.forEach((cookie) => {
              cookiesToSet.push(cookie)
            })
          },
        },
      }
    )
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('Error exchanging code for session:', error)
        return NextResponse.redirect(`${requestUrl.origin}?error=auth_error`)
      }
      
      // Create response and set cookies on it
      const response = NextResponse.redirect(redirectUrl)
      
      // Set all cookies on the response
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      
      console.log('[Auth Callback] Set cookies:', cookiesToSet.map(c => c.name))
      
      return response
    } catch (error) {
      console.error('Unexpected error during auth callback:', error)
      return NextResponse.redirect(`${requestUrl.origin}?error=auth_error`)
    }
  }

  // No code provided, just redirect
  return NextResponse.redirect(redirectUrl)
}
