'use client'
// src/app/(dashboard)/waiter/orders/[orderId]/payment/page.tsx
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface OrderDetail {
  id: number
  total_price: number
  discount_amount: number
  tables: { table_number: string } | null
  order_items: {
    id: number; quantity: number; subtotal: number
    products: { name: string; price: number } | null
  }[]
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: '💵 Tiền mặt',      },
  { value: 'transfer', label: '📱 Chuyển khoản',  },
  { value: 'card',     label: '💳 Thẻ',           },
]

// Các mức giảm giá nhanh
const QUICK_DISCOUNTS = [
  { label: '5%',   type: 'percent', value: 5  },
  { label: '10%',  type: 'percent', value: 10 },
  { label: '20%',  type: 'percent', value: 20 },
  { label: '50k',  type: 'amount',  value: 50000  },
  { label: '100k', type: 'amount',  value: 100000 },
]

export default function PaymentPage() {
  const router  = useRouter()
  const params  = useParams()
  const orderId = params.orderId as string

  const [order, setOrder]               = useState<OrderDetail | null>(null)
  const [loading, setLoading]           = useState(true)
  const [paymentMethod, setMethod]      = useState('cash')
  const [discountType, setDiscountType] = useState<'none'|'percent'|'amount'>('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [amountReceived, setAmountReceived] = useState(0)
  const [submitting, setSubmitting]     = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(j => { setOrder(j.data); setLoading(false) })
  }, [orderId])

  if (loading || !order) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  // Tính toán
  const totalPrice = order.total_price
  const discountAmount = discountType === 'percent'
    ? Math.round(totalPrice * discountValue / 100)
    : discountType === 'amount' ? Math.min(discountValue, totalPrice) : 0
  const finalAmount  = totalPrice - discountAmount
  const changeAmount = paymentMethod === 'cash'
    ? Math.max(0, amountReceived - finalAmount) : 0
  const isEnough = paymentMethod !== 'cash' || amountReceived >= finalAmount

  // Gợi ý tiền dựa trên mệnh giá tiền Việt Nam
  const VN_NOTES = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]

  function getQuickAmounts(amount: number): number[] {
    const suggestions = new Set<number>()

    // 1. Đúng số tiền
    suggestions.add(amount)

    // 2. Làm tròn lên theo từng mốc tiền Việt
    const roundTargets = [5000, 10000, 20000, 50000, 100000, 200000, 500000]
    for (const r of roundTargets) {
      const rounded = Math.ceil(amount / r) * r
      if (rounded >= amount) suggestions.add(rounded)
      if (suggestions.size >= 6) break
    }

    // Luôn thêm 500k nếu chưa đủ
    if (suggestions.size < 6) suggestions.add(Math.ceil(amount / 500000) * 500000)

    // Gợi ý combo tờ tiền tự nhiên (greedy)
    // VD: 126k → 100k + 20k + 5k + 2k = 127k (tờ tiền ít nhất ≥ amount)
    let remaining = amount
    let combo = 0
    for (const note of VN_NOTES) {
      const count = Math.floor(remaining / note)
      combo += count * note
      remaining -= count * note
    }
    // Nếu còn dư → thêm tờ nhỏ nhất đủ bù
    if (remaining > 0) {
      for (const note of [...VN_NOTES].reverse()) {
        if (note >= remaining) { combo += note; break }
      }
    }
    if (combo >= amount) suggestions.add(combo)

    return [...suggestions]
      .filter(v => v >= amount)
      .sort((a, b) => a - b)
      .slice(0, 6)
  }

  const quickAmounts = getQuickAmounts(finalAmount)

  async function handlePayment() {
    if (!isEnough) return toast.error('Tiền nhận chưa đủ')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, discountType, discountValue, amountReceived }),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error)

      toast.success(data.data.message)
      router.push('/waiter/tables')
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-secondary text-sm">← Quay lại</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Thanh toán</h1>
          <p className="text-sm text-gray-500">Bàn {order.tables?.table_number} · Order #{orderId}</p>
        </div>
      </div>

      {/* Danh sách món */}
      <div className="card mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Hoá đơn</h2>
        <div className="space-y-2 mb-4">
          {order.order_items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.quantity}× {item.products?.name}</span>
              <span className="font-medium">{item.subtotal.toLocaleString('vi-VN')}đ</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Tạm tính</span><span>{totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Giảm giá</span><span>−{discountAmount.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-gray-900">
            <span>Tổng cộng</span><span>{finalAmount.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
      </div>

      {/* Giảm giá */}
      <div className="card mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Giảm giá</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setDiscountType('none'); setDiscountValue(0) }}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              discountType === 'none' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600')}
          >Không giảm</button>
          {QUICK_DISCOUNTS.map(d => (
            <button key={d.label}
              onClick={() => { setDiscountType(d.type as any); setDiscountValue(d.value) }}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                discountType === d.type && discountValue === d.value
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-green-50')}
            >{d.label}</button>
          ))}
        </div>
        {/* Nhập thủ công */}
        <div className="flex gap-2 mt-3">
          <select
            value={discountType}
            onChange={e => { setDiscountType(e.target.value as any); setDiscountValue(0) }}
            className="input w-32 text-sm"
          >
            <option value="none">Không</option>
            <option value="percent">%</option>
            <option value="amount">Số tiền</option>
          </select>
          {discountType !== 'none' && (
            <input type="number" value={discountValue || ''}
              onChange={e => setDiscountValue(Number(e.target.value))}
              placeholder={discountType === 'percent' ? 'VD: 10' : 'VD: 50000'}
              className="input flex-1 text-sm"
            />
          )}
        </div>
      </div>

      {/* Phương thức thanh toán */}
      <div className="card mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Phương thức</h2>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button key={m.value}
              onClick={() => setMethod(m.value)}
              className={clsx('py-3 rounded-xl border-2 text-sm font-medium transition-colors',
                paymentMethod === m.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {/* Tiền mặt — nhập số tiền nhận */}
      {paymentMethod === 'cash' && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Tiền khách đưa</h2>
          <input type="number" value={amountReceived || ''}
            onChange={e => setAmountReceived(Number(e.target.value))}
            placeholder="Nhập số tiền..."
            className="input mb-3"
          />
          {/* Gợi ý nhanh */}
          <div className="flex gap-2 flex-wrap">
            {quickAmounts.map(amt => (
              <button key={amt} onClick={() => setAmountReceived(amt)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  amountReceived === amt
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50')}
              >{amt.toLocaleString('vi-VN')}đ</button>
            ))}
          </div>
          {/* Tiền thừa */}
          {amountReceived >= finalAmount && (
            <div className="mt-3 p-3 bg-green-50 rounded-xl">
              <p className="text-sm text-green-700 font-medium">
                💰 Tiền thừa: <span className="text-lg font-bold">{changeAmount.toLocaleString('vi-VN')}đ</span>
              </p>
            </div>
          )}
          {amountReceived > 0 && amountReceived < finalAmount && (
            <div className="mt-3 p-3 bg-red-50 rounded-xl">
              <p className="text-sm text-red-600">
                ⚠️ Còn thiếu: {(finalAmount - amountReceived).toLocaleString('vi-VN')}đ
              </p>
            </div>
          )}
        </div>
      )}

      {/* Nút thanh toán */}
      <button
        onClick={handlePayment}
        disabled={submitting || !isEnough}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl
                   text-lg transition-colors disabled:opacity-50 shadow-lg"
      >
        {submitting ? 'Đang xử lý...' : `✓ Xác nhận thanh toán · ${finalAmount.toLocaleString('vi-VN')}đ`}
      </button>
    </div>
  )
}