//src\app\(dashboard)\layout.tsx

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Navbar from '@/components/ui/Navbar'
import MainWrapper from '@/components/ui/MainWrapper'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
  <div className="min-h-screen flex flex-col">
    <Navbar session={session} />
    <MainWrapper>{children}</MainWrapper>
  </div>
)
}