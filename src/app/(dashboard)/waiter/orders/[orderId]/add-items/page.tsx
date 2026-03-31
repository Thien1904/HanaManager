'use client'
// src/app/(dashboard)/waiter/orders/[orderId]/add-items/page.tsx
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProducts, Product, ProductVariant } from '@/hooks/useProducts'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface CartItem {
  productId:   number
  variantId:   number | null
  variantName: string | null
  name:        string
  price:       number
  quantity:    number
  notes:       string
}

function cartKey(productId: number, variantId: number | null) {
  return `${productId}-${variantId ?? 'base'}`
}

/**
 * VariantPicker — Popup chọn size
 */
function VariantPicker({
  product, onSelect, onClose,
}: {
  product: Product
  onSelect: (variant: ProductVariant | null) => void
  onClose: () => void
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm'>
        <div className='flex items-center justify-between px-5 py-4 border-b'>
          <div>
            <h3 className='font-bold text-gray-900'>{product.name}</h3>
            <p className='text-xs text-gray-400 mt-0.5'>Chọn size</p>
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>
        <div className='p-4 space-y-2'>
          {product.variants.map((v) => (
            <button key={v.id} onClick={() => onSelect(v)}
              className='w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-95'>
              <span className='font-medium text-gray-900'>{v.name}</span>
              <span className='font-bold text-blue-600'>{v.price.toLocaleString('vi-VN')}đ</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)

  useEffect(() => {
    window.fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((j) => setTableNumber(j.data?.tables?.table_number ?? ''))
  }, [orderId])

  useEffect(() => {
    const cats = Object.keys(grouped)
    if (cats.length > 0 && !activeCategory) setCategory(cats[0])
  }, [grouped, activeCategory])

  function handleProductClick(product: Product) {
    if (product.variants.length > 0) {
      setVariantProduct(product)
    } else {
      addToCart(product, null)
    }
  }

  function handleVariantSelect(variant: ProductVariant | null) {
    if (!variantProduct) return
    addToCart(variantProduct, variant)
    setVariantProduct(null)
  }

  function addToCart(product: Product, variant: ProductVariant | null) {
    const key   = cartKey(product.id, variant?.id ?? null)
    const price = variant ? variant.price : product.price
    const name  = variant ? `${product.name} (${variant.name})` : product.name

    setCart((prev) => {
      const existing = prev.find((i) => cartKey(i.productId, i.variantId) === key)
      if (existing) {
        return prev.map((i) =>
          cartKey(i.productId, i.variantId) === key
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, {
        productId:   product.id,
        variantId:   variant?.id ?? null,
        variantName: variant?.name ?? null,
        name,
        price,
        quantity:    1,
        notes:       '',
      }]
    })
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) => prev
      .map((i) => cartKey(i.productId, i.variantId) === key
        ? { ...i, quantity: i.quantity + delta }
        : i
      )
      .filter((i) => i.quantity > 0)
    )
  }

  function updateNotes(key: string, notes: string) {
    setCart((prev) => prev.map((i) =>
      cartKey(i.productId, i.variantId) === key ? { ...i, notes } : i
    ))
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  async function handleSubmit(sendToKitchen: boolean) {
    if (cart.length === 0) return toast.error('Chưa chọn món nào')
    setSubmitting(true)
    try {
      const res = await window.fetch(`/api/orders/${orderId}/items`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId:   i.productId,
            variantId:   i.variantId,
            variantName: i.variantName,
            quantity:    i.quantity,
            notes:       i.notes,
            price:       i.price,
          })),
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
    <div className='flex gap-6 h-[calc(100vh-80px)]'>

      {variantProduct && (
        <VariantPicker
          product={variantProduct}
          onSelect={handleVariantSelect}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {/* ── Cột trái ── */}
      <div className='flex-1 flex flex-col min-w-0'>
        <div className='flex items-center gap-3 mb-4'>
          <button onClick={() => router.back()} className='btn-secondary text-sm'>← Quay lại</button>
          <div>
            <h1 className='text-xl font-bold text-gray-900'>Thêm món</h1>
            <p className='text-sm text-gray-500'>Bàn {tableNumber} · Order #{orderId}</p>
          </div>
        </div>

        <div className='flex gap-2 mb-4 overflow-x-auto pb-1'>
          {categories.map((cat) => (
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

        {loading ? (
          <div className='grid grid-cols-2 lg:grid-cols-3 gap-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className='h-24 rounded-xl bg-gray-100 animate-pulse' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto'>
            {(grouped[activeCategory] ?? []).map((product) => {
              const hasVariants = product.variants.length > 0
              const totalInCart = cart
                .filter((i) => i.productId === product.id)
                .reduce((s, i) => s + i.quantity, 0)

              return (
                <button key={product.id} onClick={() => handleProductClick(product)}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-95',
                    totalInCart > 0
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <p className='font-medium text-gray-900 text-sm line-clamp-2'>{product.name}</p>
                  {hasVariants ? (
                    <p className='text-orange-500 text-xs mt-1 font-medium'>
                      {product.variants.length} size · từ {Math.min(...product.variants.map((v) => v.price)).toLocaleString('vi-VN')}đ
                    </p>
                  ) : (
                    <p className='text-blue-600 font-bold text-sm mt-1'>
                      {product.price.toLocaleString('vi-VN')}đ
                    </p>
                  )}
                  {totalInCart > 0 && (
                    <span className='text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full mt-1 inline-block'>
                      x{totalInCart}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Cột phải ── */}
      <div className='w-72 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm'>
        <div className='px-4 py-3 border-b border-gray-100'>
          <h2 className='font-bold text-gray-900'>
            Món thêm
            {cart.length > 0 && (
              <span className='ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full'>
                {cart.reduce((s, i) => s + i.quantity, 0)} món
              </span>
            )}
          </h2>
        </div>

        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-3'>
          {cart.length === 0 ? (
            <p className='text-sm text-gray-400 text-center py-8'>Chưa chọn món nào</p>
          ) : (
            cart.map((item) => {
              const key = cartKey(item.productId, item.variantId)
              return (
                <div key={key} className='space-y-1.5 pb-2 border-b border-gray-100 last:border-0'>
                  <div className='flex items-center gap-2'>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-900 truncate'>{item.name}</p>
                      <p className='text-xs text-gray-500'>
                        {item.price.toLocaleString('vi-VN')}đ × {item.quantity} ={' '}
                        <span className='font-medium text-gray-700'>
                          {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                        </span>
                      </p>
                    </div>
                    <div className='flex items-center gap-1 shrink-0'>
                      <button onClick={() => updateQuantity(key, -1)}
                        className='w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 text-sm font-bold transition-colors'>−</button>
                      <span className='w-5 text-center text-sm font-bold'>{item.quantity}</span>
                      <button onClick={() => updateQuantity(key, +1)}
                        className='w-6 h-6 rounded-full bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 text-sm font-bold transition-colors'>+</button>
                    </div>
                  </div>
                  <input type='text' value={item.notes}
                    onChange={(e) => updateNotes(key, e.target.value)}
                    placeholder='Ghi chú... (ít cay, không hành)'
                    className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400'
                  />
                </div>
              )
            })
          )}
        </div>

        <div className='px-4 py-3 border-t border-gray-100 space-y-2'>
          <div className='flex justify-between font-bold text-gray-900 mb-1'>
            <span>Tổng thêm</span>
            <span>{total.toLocaleString('vi-VN')}đ</span>
          </div>
          <button onClick={() => handleSubmit(true)}
            disabled={cart.length === 0 || submitting}
            className='w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm'>
            {submitting ? 'Đang xử lý...' : '🔔 Thêm & Báo bếp luôn'}
          </button>
          <button onClick={() => handleSubmit(false)}
            disabled={cart.length === 0 || submitting}
            className='w-full btn-secondary py-2.5 text-sm font-medium disabled:opacity-50'>
            + Chỉ thêm món
          </button>
        </div>
      </div>
    </div>
  )
}