'use client'
// src/components/ui/Navbar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SessionPayload } from '@/lib/auth-edge'
import { useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
interface NavItem {
  href: string
  label: string
  icon: string
  children?: NavItem[] // Dấu ? nghĩa là có thể có hoặc không, và nó đệ quy chính nó
}
const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { href: '/admin/reports', label: 'Báo cáo', icon: '📊' },
    { href: '/admin/menu', label: 'Thực đơn', icon: '🍜' },
    { href: '/admin/ingredients', label: 'Kho', icon: '📦' },
    {
      href: '/admin/staff',
      label: 'Nhân viên',
      icon: '👥',
      children: [
        { href: '/admin/permissions', label: 'Phân Quyền', icon: '📋' },
        { href: '/admin/payroll', label: 'Lương', icon: '💰' },
      ],
    },
    { href: '/admin/schedule', label: 'Lịch làm', icon: '📅' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
    { href: '/waiter', label: 'Phục vụ', icon: '🪑' },
    { href: '/waiter/orders', label: 'Đơn hàng', icon: '📋' },
  ],
  waiter: [
    { href: '/waiter/tables', label: 'Quản lý bàn', icon: '🪑' },
    { href: '/waiter/orders', label: 'Đơn hàng', icon: '📋' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
  ],
  chef: [
    { href: '/chef/kitchen', label: 'Màn hình bếp', icon: '👨‍🍳' },
    { href: '/chat', label: 'AI Chat', icon: '🤖' },
  ],
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-orange-100 text-orange-700',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản lý',
  waiter: 'Phục vụ',
  chef: 'Bếp trưởng',
}

export default function Navbar({ session }: { session: SessionPayload }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const navItems = NAV_ITEMS[session.role] ?? []

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Đã đăng xuất')
    window.location.href = '/login'
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center h-14 gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🍽️</span>
            <span className="font-bold text-gray-900 text-sm">Restaurant POS</span>
          </Link>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200" />

          {/* Nav links */}
          {/* Nav links - ĐỔI overflow-x-auto THÀNH overflow-visible */}
          <nav className="flex items-center gap-1 flex-1 overflow-visible">
            {navItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0

              return (
                <div key={item.href} className="relative group py-2">
                  {' '}
                  {/* Thêm py-2 để tăng vùng hover */}
                  {/* Menu Cha */}
                  <Link
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                      // ĐỔI child.href THÀNH item.href Ở ĐÂY
                      pathname.startsWith(item.href)
                        ? 'bg-gray-900 text-white font-medium' // Style cho mục cha khi đang active
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    {hasChildren && <span className="text-[10px] ml-1 opacity-50">▼</span>}
                  </Link>
                  {/* Menu Con - Hiển thị khi Group Hover */}
                  {hasChildren && (
                    <div className="absolute left-0 top-[calc(100%-5px)] hidden group-hover:block z-50 pt-2">
                      <div className="bg-white border border-gray-200 shadow-xl rounded-lg w-48 overflow-hidden py-1">
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={clsx(
                              'flex items-center gap-2 px-4 py-2 text-sm transition-colors',

                              pathname === child.href
                                ? 'text-blue-600 bg-blue-50 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600',
                            )}
                          >
                            <span>{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                {(session.fullName || session.username).charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {session.fullName || session.username}
                </p>
              </div>
              <span
                className={clsx(
                  'text-xs px-2 py-0.5 rounded-full font-medium hidden sm:block',
                  ROLE_BADGE[session.role],
                )}
              >
                {ROLE_LABEL[session.role]}
              </span>
              <svg
                className="w-3.5 h-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400">Đăng nhập với</p>
                    <p className="text-sm font-semibold text-gray-900">{session.username}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span> Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
