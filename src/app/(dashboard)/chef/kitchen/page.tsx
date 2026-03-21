'use client'

// src/app/(dashboard)/kitchen/page.tsx
import { useState } from 'react'
import { useKitchenTickets, KitchenTicket } from '@/hooks/useKitchenTickets'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Config màu theo status ──────────────────────────────────
const TICKET_STYLE = {
  sent: {
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    header: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    label: '🔔 Mới',
  },
  acknowledged: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    header: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    label: '👨‍🍳 Đang nấu',
  },
  completed: {
    border: 'border-green-300',
    bg: 'bg-green-50',
    header: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    label: '✅ Xong',
  },
  cancelled: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    header: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    label: '🚫 HỦY MÓN',
  },

}

// ── Tính thời gian chờ ──────────────────────────────────────
function getWaitTime(sentAt: string): { text: string; urgent: boolean } {
  const mins = Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000)
  if (mins < 1) return { text: 'Vừa xong', urgent: false }
  if (mins < 10) return { text: `${mins} phút`, urgent: false }
  if (mins < 20) return { text: `${mins} phút`, urgent: true }
  return { text: `${mins} phút ⚠️`, urgent: true }
}

// ── Component 1 phiếu bếp ───────────────────────────────────
function TicketCard({
  ticket,
  onAction,
  processing,

}: {
  ticket: KitchenTicket
  onAction: (ticketId: number, action: string) => void
  processing: boolean
}) {
  const style = TICKET_STYLE[ticket.status] ?? TICKET_STYLE.sent
  const wait = getWaitTime(ticket.sent_at)

  return (
    <div className={clsx(
      'rounded-2xl border-2 overflow-hidden shadow-sm transition-all',
      style.border, style.bg,
      processing && 'opacity-60'
    )}>

      {/* Header phiếu */}
      <div className={clsx('px-4 py-2.5 flex items-center justify-between', style.header)}>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">
            Bàn {ticket.tables?.table_number ?? '?'}
          </span>
          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
            #{ticket.id}
          </span>
        </div>
        <div className="text-right">
          <p className={clsx('text-xs font-bold', wait.urgent ? 'text-yellow-200' : 'text-white/80')}>
            ⏱ {wait.text}
          </p>
          <p className="text-white/70 text-xs">
            {new Date(ticket.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Danh sách món */}
      <div className="px-4 py-3 space-y-2">
        {ticket.items_snapshot.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {/* Số lượng nổi bật */}
            <span className="text-xl font-black text-gray-900 leading-none w-8 shrink-0">
              {item.quantity}×
            </span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
              {item.notes && (
                <p className="text-xs text-red-600 font-medium mt-0.5">
                  📝 {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Ghi chú chung */}
        {ticket.note && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">🗒 {ticket.note}</p>
          </div>
        )}
      </div>

      {/* Nút hành động */}
      <div className="px-4 pb-4 flex gap-2">
        {ticket.status === 'sent' && (
          <button
            onClick={() => onAction(ticket.id, 'acknowledge')}
            disabled={processing}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold
                       py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {processing ? '...' : '👍 Đã nhận'}
          </button>
        )}

        {ticket.status === 'acknowledged' && (
          <button
            onClick={() => onAction(ticket.id, 'complete')}
            disabled={processing}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold
                       py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {processing ? '...' : '✅ Xong món'}
          </button>
        )}
        {ticket.status === 'cancelled' && (
          <button
            onClick={() => onAction(ticket.id, 'dismiss')}
            disabled={processing}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            {processing ? '...' : '✓ Đã biết'}
          </button>
        )}
      </div>


    </div>
  )
}

// ── Skeleton loading ────────────────────────────────────────
function TicketSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

// ── Page chính ──────────────────────────────────────────────
export default function KitchenPage() {
  const { tickets, loading, error, refresh } = useKitchenTickets()
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Phân loại: chờ xác nhận vs đang nấu
  const newTickets = tickets.filter(t => t.status === 'sent')
  const cookingTickets = tickets.filter(t => t.status === 'acknowledged')
const cancelledTickets = tickets.filter(t => t.status === 'cancelled')
  async function handleAction(ticketId: number, action: string) {
    setProcessingId(ticketId)
    try {
      const res = await fetch('/api/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, action }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)

      if (action === 'acknowledge') toast.success('Đã nhận phiếu!')
      if (action === 'complete') toast.success('Hoàn thành món! 🎉')
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div>
      {/* Header */}
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Màn hình bếp</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {newTickets.length} phiếu mới · {cookingTickets.length} đang nấu
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary text-sm">
          🔄 Làm mới
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <TicketSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          <p className="text-4xl mb-3">⚠️</p>
          <p>{error}</p>
          <button onClick={refresh} className="btn-secondary mt-4">Thử lại</button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">🍳</p>
          <p className="text-lg font-medium">Không có phiếu nào</p>
          <p className="text-sm mt-1">Đang chờ order mới...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cancelledTickets.map(ticket => (
  <TicketCard
    key={ticket.id}
    ticket={ticket}
    onAction={handleAction}
    processing={processingId === ticket.id}
  />
))}
          {/* Phiếu mới hiện trước */}
          
          {newTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onAction={handleAction}
              processing={processingId === ticket.id}
            />
          ))}
          {/* Đang nấu */}
          {cookingTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onAction={handleAction}
              processing={processingId === ticket.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}