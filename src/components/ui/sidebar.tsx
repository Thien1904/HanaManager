'use client'
// src/components/ui/Sidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SessionPayload } from '@/lib/auth-edge'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Icon đơn giản dùng emoji — sau này có thể đổi sang lucide-react
const NAV_ITEMS = {
  admin: [
    { href: '/admin/reports', label: 'Báo cáo', icon: '📊' },
    { href: '/admin/menu', label: 'Thực đơn', icon: '🍜' },
    { href: '/admin/inventory', label: 'Kho nguyên liệu', icon: '📦' },
    { href: '/admin/staff', label: 'Nhân viên', icon: '👥' },
    { href: '/admin/schedule', label: 'Lịch làm việc', icon: '📅' },
    { href: '/admin/payroll', label: 'Bảng lương', icon: '💰' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
    { href: '/waiter/tables', label: 'Quản lý bàn', icon: '🪑' },
    { href: '/waiter/orders', label: 'Đơn hàng', icon: '📋' },
  ],
  waiter: [
    { href: '/waiter/tables', label: 'Quản lý bàn', icon: '🪑' },
    { href: '/waiter/orders', label: 'Đơn hàng', icon: '📋' },
    { href: '/waiter/reports', label: 'Báo cáo', icon: '📊' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
    { href: '/admin/menu', label: 'Thực đơn', icon: '🍜' },
  ],
  chef: [
    { href: '/chef/kitchen', label: 'Màn hình bếp', icon: '👨‍🍳' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
    { href: '/admin/menu', label: 'Thực đơn', icon: '🍜' },
  ],
}

const ROLE_LABEL = {
  admin: 'Quản lý',
  waiter: 'Phục vụ',
  chef: 'Bếp',
}

interface SidebarProps {
  session: SessionPayload
}

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = NAV_ITEMS[session.role] ?? []

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Đã đăng xuất')
    router.push('/login')
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-full shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍽️</span>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Restaurant</p>
            <p className="text-xs text-gray-400">POS System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-medium text-gray-800 truncate">
          {session.fullName || session.username}
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">
          {ROLE_LABEL[session.role]}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <span className="text-base">🚪</span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
