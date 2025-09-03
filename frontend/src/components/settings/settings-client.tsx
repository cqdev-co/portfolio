'use client'

import { User } from '@supabase/supabase-js'
import { ProfileTab } from './profile-tab'

interface SettingsClientProps {
  user: User
}

export function SettingsClient({ user }: SettingsClientProps) {
  return <ProfileTab user={user} showDangerZone />
}
