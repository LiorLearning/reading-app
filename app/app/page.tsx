'use client'

import dynamic from 'next/dynamic'
import { AuthGuard } from '@/components/auth/AuthGuard'

// Dynamic import for code splitting - this is a very large component tree
const UnifiedPetAdventureApp = dynamic(
  () => import('@/components/UnifiedPetAdventureApp').then(mod => ({ default: mod.UnifiedPetAdventureApp })),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="flex items-center gap-3 text-white text-xl animate-pulse">
          <img src="/avatars/krafty.png" alt="Krafty" className="h-10 w-10 object-contain" />
          Loading...
        </div>
      </div>
    ),
    ssr: false
  }
)


export default function AppPage() {
  return (
    <AuthGuard>
      <UnifiedPetAdventureApp />
    </AuthGuard>
  )
}
