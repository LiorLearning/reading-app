'use client'

import { Suspense } from 'react'
import { AuthScreen } from '@/components/auth/AuthScreen'

// Disable static generation - requires auth
export const dynamic = 'force-dynamic'

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthScreen />
    </Suspense>
  )
}
