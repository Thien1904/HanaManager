// src/app/page.tsx
// Trang gốc: tự redirect về trang phù hợp
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getHomeByRole } from '@/proxy'

export default async function RootPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  redirect(getHomeByRole(session.role))
}
