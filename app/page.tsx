'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Welcome from '@/components-pages/Welcome'

// Disable static generation - requires auth
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return <Welcome />
}
