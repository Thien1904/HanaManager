'use client'
// src/app/(dashboard)/waiter/orders/new/page.tsx
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProducts, Product, ProductVariant } from '@/hooks/useProducts'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// CartItem mở rộng hỗ trợ variant
interface CartItem {
  productId:   number
  variantId:   number | null   // null = không có size
  variantName: string | null   // "S", "M", "L"
  name:        string
  price:       number          // giá đã chọn (theo variant hoặc product)
  quantity:    number
  notes:       string
}

// Key duy nhất cho cart item — phân biệt cùng món nhưng khác size
function cartKey(productId: number, variantId: number | null) {
  return `${productId}-${variantId ?? 'base'}`
}

/**
 * VariantPicker — Popup chọn size khi bấm vào món có variants
 */
function VariantPicker({
  product,
  onSelect,
  onClose,
}: {
  product:  Product
  onSelect: (variant: ProductVariant | null) => void
  onClose:  () => void
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
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className='w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-95'
            >
              <span className='font-medium text-gray-900'>{v.name}</span>
              <span className='font-bold text-blue-600'>{v.price.toLocaleString('vi-VN')}đ</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tableId      = searchParams.get('tableId')
  const tableNumber  = searchParams.get('tableNumber') ?? 'Không rõ'

  const { grouped, loading } = useProducts()

  const [cart, setCart]               = useState<CartItem[]>([])
  const [note, setNote]               = useState('')
  const [activeCategory, setCategory] = useState<string>('')
  const [submitting, setSubmitting]   = useState(false)

  // State popup chọn size
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)

  useEffect(() => {
    const cats = Object.keys(grouped)
    if (cats.length > 0 && !activeCategory) setCategory(cats[0])
  }, [grouped, activeCategory])

  /**
   * handleProductClick — bấm vào món:
   * - Có variants → mở popup chọn size
   * - Không có variants → thêm thẳng vào cart
   */
  function handleProductClick(product: Product) {
    if (product.variants.length > 0) {
      setVariantProduct(product)
    } else {
      addToCart(product, null)
    }
  }

  /**
   * handleVariantSelect — chọn size xong → thêm vào cart
   */
  function handleVariantSelect(variant: ProductVariant | null) {
    if (!variantProduct) return
    addToCart(variantProduct, variant)
    setVariantProduct(null)
  }

  /**
   * addToCart — thêm món (với hoặc không có variant) vào giỏ
   */
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

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  async function handleSubmit() {
    if (!tableId)        return toast.error('Không xác định được bàn')
    if (cart.length === 0) return toast.error('Chưa chọn món nào')

    setSubmitting(true)
    try {
      const res = await window.fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: parseInt(tableId),
          items:   cart.map((i) => ({
            productId:   i.productId,
            variantId:   i.variantId,
            variantName: i.variantName,
            quantity:    i.quantity,
            notes:       i.notes,
            price:       i.price,   // gửi giá đã chọn theo variant
          })),
          note,
        }),
      })

      const data = await res.json()
      if (!res.ok) return toast.error(data.error)

      toast.success(`Tạo order thành công! Bàn ${tableNumber}`)
      router.push(`/waiter/orders/${data.data.orderId}`)
    } catch {
      toast.error('Lỗi kết nối, thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  const categories = Object.keys(grouped)

  return (
    <div className='flex gap-6 h-[calc(100vh-80px)]'>

      {/* Popup chọn size */}
      {variantProduct && (
        <VariantPicker
          product={variantProduct}
          onSelect={handleVariantSelect}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {/* ── Cột trái: Danh sách món ── */}
      <div className='flex-1 flex flex-col min-w-0'>
        <div className='flex items-center gap-3 mb-4'>
          <button onClick={() => router.back()} className='btn-secondary text-sm'>← Quay lại</button>
          <div>
            <h1 className='text-xl font-bold text-gray-900'>Tạo order mới</h1>
            <p className='text-sm text-gray-500'>Bàn {tableNumber}</p>
          </div>
        </div>

        {/* Tab category */}
        <div className='flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none'>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors font-medium',
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
          <div className='grid grid-cols-2 lg:grid-cols-3 gap-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className='h-24 rounded-xl bg-gray-100 animate-pulse' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto'>
            {(grouped[activeCategory] ?? []).map((product) => {
              const hasVariants = product.variants.length > 0
              // Đếm tổng số lượng trong cart của món này (mọi size)
              const totalInCart = cart
                .filter((i) => i.productId === product.id)
                .reduce((s, i) => s + i.quantity, 0)

              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-95',
                    totalInCart > 0
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <p className='font-medium text-gray-900 text-sm leading-tight line-clamp-2'>
                    {product.name}
                  </p>
                  {/* Hiện "Chọn size" nếu có variant, ngược lại hiện giá */}
                  {hasVariants ? (
                    <p className='text-orange-500 text-xs mt-1 font-medium'>
                      {product.variants.length} size · từ {Math.min(...product.variants.map(v => v.price)).toLocaleString('vi-VN')}đ
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

      {/* ── Cột phải: Giỏ hàng ── */}
      <div className='w-72 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm'>
        <div className='px-4 py-3 border-b border-gray-100'>
          <h2 className='font-bold text-gray-900'>
            Giỏ hàng
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
                    placeholder='Ghi chú món này...'
                    className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400'
                  />
                </div>
              )
            })
          )}
        </div>

        <div className='px-4 py-2 border-t border-gray-100'>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder='Ghi chú cho bếp...' rows={2}
            className='input text-xs resize-none' />
        </div>

        <div className='px-4 py-3 border-t border-gray-100'>
          <div className='flex justify-between mb-3'>
            <span className='font-medium text-gray-700'>Tổng cộng</span>
            <span className='font-bold text-lg text-gray-900'>{total.toLocaleString('vi-VN')}đ</span>
          </div>
          <button onClick={handleSubmit} disabled={cart.length === 0 || submitting}
            className='btn-primary w-full'>
            {submitting ? 'Đang tạo...' : '✓ Tạo Order'}
          </button>
        </div>
      </div>
    </div>
  )
}