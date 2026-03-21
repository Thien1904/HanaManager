'use client'
import { usePathname } from 'next/navigation'

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullScreen = pathname.startsWith('/waiter') || pathname.startsWith('/kitchen')

  if (isFullScreen) return (
    <div className="flex-1 overflow-hidden">
      {children}
    </div>
  )

  return (
    <main className="flex-1 bg-gray-50 max-w-7xl mx-auto w-full px-6 py-6">
      {children}
    </main>
  )
}