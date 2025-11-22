'use client'

import { ProgressTracking } from '@/components-pages/ProgressTracking'
import { AuthGuard } from '@/components/auth/AuthGuard'

// Disable static generation - requires auth
export const dynamic = 'force-dynamic'

export default function ProgressPage() {
  return (
    <AuthGuard>
      <ProgressTracking />
    </AuthGuard>
  )
}
