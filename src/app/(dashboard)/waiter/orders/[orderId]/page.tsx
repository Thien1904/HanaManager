'use client'
// src/app/(dashboard)/waiter/orders/[orderId]/page.tsx
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface OrderItem {
  id: number
  quantity: number
  subtotal: number
  notes: string | null
  products: { id: number; name: string; price: number } | null
}

interface OrderDetail {
  id: number
  status: string
  payment_status: string
  total_price: number
  discount_amount: number
  note: string | null
  created_at: string
  tables:    { table_number: string } | null
  users:     { full_name: string }    | null
  customers: { name: string; phone: string } | null
  order_items: OrderItem[]
}

const STATUS_LABEL: Record<string, string> = {
  pending:         '⏳ Chờ báo bếp',
  sent_to_kitchen: '📨 Đã báo bếp',
  preparing:       '👨‍🍳 Đang nấu',
  served:          '✅ Đã phục vụ',
  paid:            '💰 Đã thanh toán',
  cancelled:       '❌ Đã huỷ',
}

const STATUS_COLOR: Record<string, string> = {
  pending:         'bg-yellow-100 text-yellow-700',
  sent_to_kitchen: 'bg-blue-100 text-blue-700',
  preparing:       'bg-orange-100 text-orange-700',
  served:          'bg-green-100 text-green-700',
  paid:            'bg-gray-100 text-gray-600',
  cancelled:       'bg-red-100 text-red-600',
}

// ── Popup hủy số lượng ─────────────────────────────────────
function CancelQtyModal({
  item,
  isAfterKitchen,
  onConfirm,
  onClose,
}: {
  item: OrderItem
  isAfterKitchen: boolean
  onConfirm: (qty: number, reason: string, customReason: string) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-1">Hủy món</h3>
        <p className="text-sm text-gray-500 mb-4">
          {item.products?.name} · Hiện có: <strong>{item.quantity}</strong>
        </p>
{/* Lý do hủy */}
<p className="text-sm font-medium text-gray-700 mb-2">Lý do huỷ:</p>
<div className="flex flex-wrap gap-2 mb-3">
  {['Khách yêu cầu', 'Order sai', 'Hết món', 'Tự ghi lý do'].map(r => (
    <button key={r} onClick={() => setReason(r)}
      className={clsx(
        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
        reason === r
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      )}
    >{r}</button>
  ))}
</div>
{reason === 'Tự ghi lý do' && (
  <input
    type="text"
    value={customReason}
    onChange={e => setCustomReason(e.target.value)}
    placeholder="Nhập lý do..."
    className="input w-full mb-3 text-sm"
    autoFocus
  />
)}
        {isAfterKitchen && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-xs text-orange-700">
              ⚠️ Đã báo bếp — sẽ gửi phiếu HỦY đến bếp/bar
            </p>
          </div>
        )}

        {/* Chọn số lượng hủy */}
        <p className="text-sm font-medium text-gray-700 mb-2">Số lượng muốn hủy:</p>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-xl font-bold transition-colors"
          >−</button>
          <span className="text-2xl font-bold text-gray-900 w-12 text-center">{qty}</span>
          <button
            onClick={() => setQty(q => Math.min(item.quantity, q + 1))}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-xl font-bold transition-colors"
          >+</button>
          {/* Nút hủy hết nhanh */}
          {item.quantity > 1 && (
            <button
              onClick={() => setQty(item.quantity)}
              className="text-xs text-red-500 hover:underline ml-2"
            >
              Hủy hết ({item.quantity})
            </button>
          )}
        </div>

        {/* Tóm tắt */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm">
          <p className="text-gray-600">
            Hủy <strong>{qty}</strong> / {item.quantity} · Còn lại: <strong>{item.quantity - qty}</strong>
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
         
<button
  onClick={() => onConfirm(qty, reason, customReason)}
  disabled={!reason || (reason === 'Tự ghi lý do' && !customReason.trim())}
  className={clsx(
    'flex-1 py-2.5 rounded-xl font-bold text-white transition-colors',
    isAfterKitchen ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600',
    'disabled:opacity-40'
  )}
>
  Xác nhận hủy
</button>
        </div>
      </div>
    </div>
  )
}

// ── Page chính ─────────────────────────────────────────────
export default function OrderDetailPage() {
  const router  = useRouter()
  const params  = useParams()
  const orderId = params.orderId as string

  const [order, setOrder]           = useState<OrderDetail | null>(null)
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState(false)
  const [cancellingItem, setCancellingItem] = useState<OrderItem | null>(null)
  const [processingId, setProcessingId]     = useState<number | null>(null)

  useEffect(() => { loadOrder() }, [orderId])

  async function loadOrder() {
    try {
      const res  = await fetch(`/api/orders/${orderId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOrder(json.data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendToKitchen() {
    if (!order) return
    setSending(true)
    try {
      const res  = await fetch('/api/kitchen', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId: order.id }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)
      toast.success(`Đã báo bếp! Bàn ${order.tables?.table_number}`)
      loadOrder()
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setSending(false)
    }
  }

  // Gọi sau khi user xác nhận số lượng hủy
  async function handleConfirmCancel(item: OrderItem, cancelQty: number,  reason: string, customReason: string) {
    if (!order) return
    setCancellingItem(null)
    setProcessingId(item.id)
    const finalReason = reason === 'Tự ghi lý do' ? customReason : reason
    try {
      const res  = await fetch(`/api/orders/${order.id}/items/${item.id}`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        
        body:    JSON.stringify({ cancelQty, reason: finalReason }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)

      toast.success(json.data.message)

      if (json.data.action === 'order_cancelled') {
        router.push('/waiter/tables')
      } else {
        loadOrder()
      }
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!order) return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-4xl mb-3">🔍</p>
      <p>Không tìm thấy đơn hàng</p>
    </div>
  )

  const canCancel      = !['paid', 'cancelled'].includes(order.status)
  const isAfterKitchen = ['sent_to_kitchen', 'preparing'].includes(order.status)

  return (
    <div className="max-w-2xl mx-auto">

      {/* Popup hủy số lượng */}
      {cancellingItem && (
        <CancelQtyModal
          item={cancellingItem}
          isAfterKitchen={isAfterKitchen}
          onConfirm={(qty, reason, customReason) => handleConfirmCancel(cancellingItem, qty, reason, customReason)}
          onClose={() => setCancellingItem(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-secondary text-sm">← Quay lại</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            Order #{order.id} — Bàn {order.tables?.table_number}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(order.created_at).toLocaleString('vi-VN')} · NV: {order.users?.full_name ?? '—'}
          </p>
        </div>
        <span className={clsx('text-sm px-3 py-1 rounded-full font-medium', STATUS_COLOR[order.status])}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      {/* Cảnh báo đã báo bếp */}
      {isAfterKitchen && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="text-sm text-orange-700">
            ⚠️ Đã báo bếp — hủy món sẽ gửi <strong>phiếu HỦY</strong> đến bếp
          </p>
        </div>
      )}

      {/* Danh sách món */}
      <div className="card mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Danh sách món</h2>
        <div className="space-y-3">
          {order.order_items.filter(item => item.quantity > 0).map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.quantity}× {item.products?.name}
                </p>
                {item.notes && (
                  <p className="text-xs text-orange-600 mt-0.5">📝 {item.notes}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.products?.price.toLocaleString('vi-VN')}đ × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-sm font-semibold text-gray-900">
                  {item.subtotal.toLocaleString('vi-VN')}đ
                </p>
                {canCancel && (
                  <button
                    onClick={() => setCancellingItem(item)}
                    disabled={processingId === item.id}
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors',
                      isAfterKitchen
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-600'
                        : 'bg-red-100 hover:bg-red-200 text-red-600',
                      processingId === item.id && 'opacity-50 cursor-not-allowed'
                    )}
                    title="Hủy món"
                  >
                    {processingId === item.id ? '...' : isAfterKitchen ? '⚠' : '×'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tổng tiền */}
        <div className="border-t border-gray-100 mt-4 pt-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Tạm tính</span>
            <span>{order.total_price.toLocaleString('vi-VN')}đ</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Giảm giá</span>
              <span>−{order.discount_amount.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900">
            <span>Tổng cộng</span>
            <span>{(order.total_price - order.discount_amount).toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        {order.note && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">📝 Ghi chú: {order.note}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {order.status === 'pending' && (
          <button
            onClick={handleSendToKitchen}
            disabled={sending}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {sending ? 'Đang gửi...' : '🔔 Báo Chế Biến'}
          </button>
        )}
        {order.status === 'served' && (
          <button
            onClick={() => router.push(`/waiter/orders/${order.id}/payment`)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            💳 Thanh Toán
          </button>
        )}
        {!['paid', 'cancelled'].includes(order.status) && (
          <button
            onClick={() => router.push(`/waiter/orders/${order.id}/add-items`)}
            className="btn-secondary flex-1 py-3 text-sm font-medium"
          >
            + Thêm món
          </button>
        )}
      </div>

    </div>
  )
}