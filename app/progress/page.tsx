'use client'

import dynamic from 'next/dynamic'
import { AuthGuard } from '@/components/auth/AuthGuard'

// Dynamic import for code splitting
const ProgressTracking = dynamic(
  () => import('@/components-pages/ProgressTracking').then(mod => ({ default: mod.ProgressTracking })),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="animate-pulse text-white text-xl">Loading progress...</div>
      </div>
    ),
    ssr: false
  }
)


export default function ProgressPage() {
  return (
    <AuthGuard>
      <ProgressTracking />
    </AuthGuard>
  )
}
