import { SettingsPageClient } from '../../components/settings/settings-page-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Settings',
  description: 'Manage your account settings, billing, and security preferences',
}

export default function SettingsPage() {
  return <SettingsPageClient />
}
