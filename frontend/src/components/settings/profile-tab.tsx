'use client'

import { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  Mail, 
  CheckCircle,
  AlertCircle,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/auth-provider'
import { useRouter } from 'next/navigation'

interface ProfileTabProps {
  user: User
  showDangerZone?: boolean
}

export function ProfileTab({ user, showDangerZone = false }: ProfileTabProps) {
  const [avatarError, setAvatarError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { signOut } = useAuth()
  const router = useRouter()

  const getAvatarSrc = () => {
    if (avatarError) return null
    return user.user_metadata?.avatar_url || user.user_metadata?.picture
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      // TODO: Implement account deletion logic
      console.log('Account deletion requested')
      // For now, just sign out the user
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error deleting account:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <section>
        <h3 className="text-base font-medium mb-3">Profile</h3>
        <Separator className="mb-4" />
        
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage 
              src={getAvatarSrc()} 
              alt="Profile picture"
              onError={() => setAvatarError(true)}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
              {(user.user_metadata?.name?.[0] || user.user_metadata?.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h4 className="font-medium">
              {user.user_metadata?.full_name || user.user_metadata?.name || 'User'}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>{user.email}</span>
              {user.email_confirmed_at ? (
                <Badge variant="secondary" className="text-xs text-green-600 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unverified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Member since {formatDate(user.created_at)}
            </p>
          </div>
        </div>
      </section>

      {/* Danger Zone - Always show if showDangerZone is true */}
      {showDangerZone && (
        <section>
          <h3 className="text-base font-medium mb-3 text-destructive">Danger Zone</h3>
          <Separator className="mb-4" />
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete Account
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you absolutely sure you want to delete your account?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        This action will:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Permanently delete all your account data</li>
                        <li>Remove all your settings and preferences</li>
                        <li>Cancel any active subscriptions</li>
                        <li>Sign you out of all devices</li>
                      </ul>
                    </div>
                    <p className="font-medium text-destructive text-sm">
                      This action cannot be undone.
                    </p>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
