'use client'

import { UnifiedPetAdventureApp } from '@/components/UnifiedPetAdventureApp'
import { AuthGuard } from '@/components/auth/AuthGuard'

// Disable static generation - requires auth
export const dynamic = 'force-dynamic'

export default function AppPage() {
  return (
    <AuthGuard>
      <UnifiedPetAdventureApp />
    </AuthGuard>
  )
}
