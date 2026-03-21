'use client'
import { useState, useEffect } from 'react'


// src/app/(dashboard)/waiter/tables/page.tsx
// 'use client' vì dùng useState, useEffect bên trong hook
import { useRouter } from 'next/navigation'
import { useTables, TableWithOrder } from '@/hooks/useTables'
import clsx from 'clsx'

// ─── Màu sắc theo trạng thái bàn ───────────────────────────
const STATUS_CONFIG = {
  available: {
    bg:     'bg-white hover:bg-green-50 border-gray-200 hover:border-green-300',
    badge:  'bg-green-100 text-green-700',
    label:  'Trống',
    dot:    'bg-green-400',
  },
  occupied: {
    bg:     'bg-red-50 hover:bg-red-100 border-red-200',
    badge:  'bg-red-100 text-red-700',
    label:  'Có khách',
    dot:    'bg-red-400',
  },
  reserved: {
    bg:     'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    badge:  'bg-yellow-100 text-yellow-700',
    label:  'Đặt trước',
    dot:    'bg-yellow-400',
  },
}

// ─── Component 1 ô bàn ─────────────────────────────────────
function TableCard({ table, onClick }: { table: TableWithOrder; onClick: () => void }) {
  const config = STATUS_CONFIG[table.status]

  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative p-4 rounded-xl border-2 transition-all duration-150 text-left w-full',
        'active:scale-95 cursor-pointer shadow-sm hover:shadow-md',
        config.bg
      )}
    >
      {/* Số bàn */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold text-gray-900">{table.table_number}</span>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', config.badge)}>
          {config.label}
        </span>
      </div>

      {/* Thông tin order nếu đang có khách */}
      {table.activeOrder ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            NV: {table.activeOrder.users?.full_name ?? '—'}
          </p>
          <p className="text-xs text-gray-500">
            Trạng thái: <span className="font-medium text-gray-700">
              {ORDER_STATUS_LABEL[table.activeOrder.status] ?? table.activeOrder.status}
            </span>
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {table.activeOrder.total_price.toLocaleString('vi-VN')}đ
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Chưa có order</p>
      )}

      {/* Dot trạng thái góc dưới phải */}
      <span className={clsx(
        'absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full',
        config.dot
      )} />
    </button>
  )
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending:          'Chờ xác nhận',
  sent_to_kitchen:  'Đã báo bếp',
  preparing:        'Đang nấu',
  served:           'Đã phục vụ',
  paid:             'Đã thanh toán',
  cancelled:        'Đã huỷ',
}

// ─── Skeleton loading ──────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

// ─── Page chính ────────────────────────────────────────────
export default function TablesPage() {
  const router = useRouter()
  const { tables, loading, error, refresh } = useTables()
  const [currentTime, setCurrentTime] = useState<string>('')
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
  }, []) // Chạy 1 lần duy nhất khi load trang
  // Thống kê nhanh
  const stats = {
    available: tables.filter(t => t.status === 'available').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
  }

 function handleTableClick(table: TableWithOrder) {
  if (table.status === 'available' || table.status === 'reserved') {
    router.push(`/waiter/orders/new?tableId=${table.id}&tableNumber=${table.table_number}`)
  } else if (table.activeOrder) {
    router.push(`/waiter/orders/${table.activeOrder.id}`)
  }
}

  return ( 
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý bàn</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tables.length} bàn · Cập nhật lúc {currentTime|| '--:--:--'}
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary text-sm flex items-center gap-2">
          🔄 Làm mới
        </button>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Bàn trống',    value: stats.available, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Đang có khách', value: stats.occupied,  color: 'text-red-600',   bg: 'bg-red-50'   },
          { label: 'Đặt trước',    value: stats.reserved,  color: 'text-yellow-600',bg: 'bg-yellow-50'},
        ].map(s => (
          <div key={s.label} className={clsx('rounded-xl p-4 text-center', s.bg)}>
            <p className={clsx('text-3xl font-bold', s.color)}>{s.value}</p>
            <p className="text-sm text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Danh sách bàn */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          <p className="text-4xl mb-3">⚠️</p>
          <p>{error}</p>
          <button onClick={refresh} className="btn-secondary mt-4">Thử lại</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onClick={() => handleTableClick(table)}
            />
          ))}
        </div>
      )}
    </div>
  )
}