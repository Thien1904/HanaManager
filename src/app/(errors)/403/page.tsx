// src/app/(errors)/403/page.tsx

import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-red-500">403</h1>
      <p className="text-xl">Không có quyền truy cập!</p>
      <Link href="/" className="mt-4 text-blue-500 underline">
        Quay về trang chủ
      </Link>
    </div>
  )
}
