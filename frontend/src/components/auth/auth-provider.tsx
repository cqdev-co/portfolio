'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(err => {
      console.error('Unexpected error in getSession:', err)
      setLoading(false)
    })

    // Listen for changes on auth state (signed in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      // Store the current page URL to redirect back to after authentication
      const returnUrl = window.location.pathname + window.location.search
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  const signOut = async () => {
    try {
      // Clear the session and remove all auth tokens
      const { error } = await supabase.auth.signOut({
        scope: 'local'
      })
      
      if (error) throw error
      
      // Force clear the user state immediately
      setUser(null)
      
      // Clear any local storage items related to auth
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          // Get all localStorage keys and remove any auth-related ones
          const keys = Object.keys(localStorage)
          keys.forEach(key => {
            if (key.includes('supabase') || 
                key.includes('auth') || 
                key.includes('sb-') ||
                key.startsWith('supabase.') ||
                key.includes('session') ||
                key.includes('token')) {
              localStorage.removeItem(key)
            }
          })
        } catch (error) {
          console.error('Error during localStorage cleanup:', error)
        }
      }
      
    } catch (error) {
      console.error('Error signing out:', error)
      // Even if there's an error, force clear the user state
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
