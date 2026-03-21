'use client'
// src/app/(dashboard)/waiter/orders/[orderId]/add-items/page.tsx
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProducts, Product } from '@/hooks/useProducts'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface CartItem {
  productId: number
  name:      string
  price:     number
  quantity:  number
  notes:     string
}

export default function AddItemsPage() {
  const router  = useRouter()
  const params  = useParams()
  const orderId = params.orderId as string

  const { grouped, loading } = useProducts()

  const [cart, setCart]               = useState<CartItem[]>([])
  const [activeCategory, setCategory] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [tableNumber, setTableNumber] = useState('')

  // Lấy thông tin bàn từ order
  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(j => setTableNumber(j.data?.tables?.table_number ?? ''))
  }, [orderId])

  // Chọn category đầu tiên khi load xong
  useEffect(() => {
    const cats = Object.keys(grouped)
    if (cats.length > 0 && !activeCategory) setCategory(cats[0])
  }, [grouped, activeCategory])

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) return prev.map(i =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      )
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, notes: '' }]
    })
  }

  function updateQuantity(productId: number, delta: number) {
    setCart(prev => prev
      .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    )
  }

  function updateNotes(productId: number, notes: string) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, notes } : i))
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  // Gửi lên API — có 2 nút: "Thêm món" và "Thêm & Báo bếp luôn"
  async function handleSubmit(sendToKitchen: boolean) {
    if (cart.length === 0) return toast.error('Chưa chọn món nào')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })),
          sendToKitchen,
        }),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error)

      toast.success(data.data.message)
      router.push(`/waiter/orders/${orderId}`)
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setSubmitting(false)
    }
  }

  const categories = Object.keys(grouped)

  return (
    <div className="flex gap-6 h-[calc(100vh-80px)]">

      {/* ── Cột trái: Danh sách món ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="btn-secondary text-sm">← Quay lại</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Thêm món</h1>
            <p className="text-sm text-gray-500">Bàn {tableNumber} · Order #{orderId}</p>
          </div>
        </div>

        {/* Tab category */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {cat} ({grouped[cat]?.length ?? 0})
            </button>
          ))}
        </div>

        {/* Grid món */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
            {(grouped[activeCategory] ?? []).map(product => {
              const inCart = cart.find(i => i.productId === product.id)
              return (
                <button key={product.id} onClick={() => addToCart(product)}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-95',
                    inCart ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <p className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</p>
                  <p className="text-blue-600 font-bold text-sm mt-1">{product.price.toLocaleString('vi-VN')}đ</p>
                  {inCart && (
                    <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      x{inCart.quantity}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Cột phải: Giỏ hàng ── */}
      <div className="w-72 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            Món thêm
            {cart.length > 0 && (
              <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)} món
              </span>
            )}
          </h2>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa chọn món nào</p>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="space-y-1.5 pb-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.price.toLocaleString('vi-VN')}đ × {item.quantity} = <span className="font-medium text-gray-700">{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQuantity(item.productId, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 text-sm font-bold transition-colors">−</button>
                    <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, +1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 text-sm font-bold transition-colors">+</button>
                  </div>
                </div>
                <input type="text" value={item.notes}
                  onChange={e => updateNotes(item.productId, e.target.value)}
                  placeholder="Ghi chú... (ít cay, không hành)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            ))
          )}
        </div>

        {/* Total + Buttons */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <div className="flex justify-between font-bold text-gray-900 mb-1">
            <span>Tổng thêm</span>
            <span>{total.toLocaleString('vi-VN')}đ</span>
          </div>

          {/* 2 nút: thêm thôi vs thêm + báo bếp luôn */}
          <button
            onClick={() => handleSubmit(true)}
            disabled={cart.length === 0 || submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {submitting ? 'Đang xử lý...' : '🔔 Thêm & Báo bếp luôn'}
          </button>

          <button
            onClick={() => handleSubmit(false)}
            disabled={cart.length === 0 || submitting}
            className="w-full btn-secondary py-2.5 text-sm font-medium disabled:opacity-50"
          >
            + Chỉ thêm món
          </button>
        </div>
      </div>
    </div>
  )
}