'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────
interface Table {
  id: number
  table_number: string
  status: 'available' | 'occupied' | 'reserved'
  activeOrder: ActiveOrder | null
}
interface ActiveOrder {
  id: number
  status: string
  total_price: number
  created_at: string
  users: { full_name: string } | null
}
interface ProductVariant {
  id: number
  name: string
  price: number
  is_default: boolean
}
interface Product {
  id: number
  name: string
  price: number
  categories: { id: number; name: string } | null
  image_url: string | null
  variants: ProductVariant[]
}
// Sửa interface OrderItem
interface OrderItem {
  id: number
  quantity: number
  subtotal: number
  notes: string | null
  variant_id: number | null
  variant_name: string | null
  products: { id: number; name: string; price: number } | null
}
interface CartItem {
  productId: number
  variantId: number | null
  variantName: string | null
  name: string
  price: number
  quantity: number
  notes: string
}
// const size for img product
const imageStyle: React.CSSProperties = {
  width: '100px',
  height: '100px',
  objectFit: 'cover',
}

const TABLE_STYLE = {
  available: 'bg-[#1a6b3c] hover:bg-[#1d7d46] border-[#1d7d46]',
  occupied: 'bg-[#6b1a1a] hover:bg-[#7d1d1d] border-[#7d1d1d]',
  reserved: 'bg-[#7a4a00] hover:bg-[#8a5500] border-[#8a5500]',
  selected:
    'bg-[#0066cc] border-[#0088ff] ring-2 ring-[#00d4ff] ring-offset-1 ring-offset-[#1a1a2e]',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ báo bếp',
  sent_to_kitchen: 'Đã báo bếp',
  preparing: 'Đang nấu',
  served: 'Đã phục vụ',
  paid: 'Đã TT',
  cancelled: 'Đã huỷ',
}

const CANCEL_REASONS = ['Khách yêu cầu', 'Order sai', 'Hết món', 'Tự ghi lý do']
// ──VariantPicker ─────────────────────────────────────────────
function VariantPicker({
  product,
  onSelect,
  onClose,
}: {
  product: Product
  onSelect: (v: ProductVariant | null) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1a1a2e] border border-white/20 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white">{product.name}</h3>
            <p className="text-xs text-white/40 mt-0.5">Chọn size</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 hover:border-[#0088ff] hover:bg-[#003366] transition-all active:scale-95"
            >
              <span className="font-medium text-white">{v.name}</span>
              <span className="font-bold text-[#00d4ff]">{v.price.toLocaleString('vi-VN')}đ</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
// ── Payment Modal ─────────────────────────────────────────────
function PaymentModal({
  orderId,
  tableNumber,
  onClose,
  onDone,
}: {
  orderId: number
  tableNumber: string
  onClose: () => void
  onDone: () => void
}) {
  const [orderData, setOrderData] = useState<any>(null)
  const [method, setMethod] = useState('cash')
  const [discType, setDiscType] = useState<'none' | 'percent' | 'amount'>('none')
  const [discValue, setDiscValue] = useState(0)
  const [received, setReceived] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((j) => setOrderData(j.data))
  }, [orderId])

  if (!orderData)
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )

  const total = orderData.total_price ?? 0
  const discount =
    discType === 'percent'
      ? Math.round((total * discValue) / 100)
      : discType === 'amount'
        ? Math.min(discValue, total)
        : 0
  const final = total - discount
  const change = method === 'cash' ? Math.max(0, received - final) : 0
  const enough = method !== 'cash' || received >= final

  const VN_NOTES = [500000, 200000, 100000, 50000, 20000, 10000]
  function quickAmounts(amt: number) {
    const s = new Set<number>([amt])
    for (const r of [10000, 20000, 50000, 100000, 200000, 500000]) {
      const v = Math.ceil(amt / r) * r
      if (v >= amt) s.add(v)
      if (s.size >= 5) break
    }
    return [...s]
      .filter((v) => v >= amt)
      .sort((a, b) => a - b)
      .slice(0, 5)
  }

  async function handlePay() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: method,
          discountType: discType,
          discountValue: discValue,
          amountReceived: received,
        }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)
      toast.success('Thanh toán thành công!')
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div>
            <h3 className="font-black text-gray-900 text-lg">💳 Thanh toán</h3>
            <p className="text-xs text-gray-500">
              Bàn {tableNumber} · Order #{orderId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {/* Danh sách món gọn */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Hoá đơn</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {(orderData.order_items ?? [])
                .filter((i: any) => i.quantity > 0)
                .map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.quantity}× {item.products?.name}
                    </span>
                    <span className="font-medium">{item.subtotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                ))}
            </div>
            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
              <span>Tạm tính</span>
              <span>{total.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>

          {/* Giảm giá */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Giảm giá</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { l: 'Không', t: 'none', v: 0 },
                { l: '5%', t: 'percent', v: 5 },
                { l: '10%', t: 'percent', v: 10 },
                { l: '20%', t: 'percent', v: 20 },
                { l: '50k', t: 'amount', v: 50000 },
                { l: '100k', t: 'amount', v: 100000 },
              ].map((d) => (
                <button
                  key={d.l}
                  onClick={() => {
                    setDiscType(d.t as any)
                    setDiscValue(d.v)
                  }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    discType === d.t && discValue === d.v
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {d.l}
                </button>
              ))}
            </div>
            {discType !== 'none' && (
              <div className="flex gap-2 mt-2">
                <select
                  value={discType}
                  onChange={(e) => setDiscType(e.target.value as any)}
                  className="border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="percent">%</option>
                  <option value="amount">Số tiền</option>
                </select>
                <input
                  type="number"
                  value={discValue || ''}
                  onChange={(e) => setDiscValue(Number(e.target.value))}
                  placeholder={discType === 'percent' ? 'VD: 10' : 'VD: 50000'}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>

          {/* Phương thức */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              Phương thức
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'cash', l: '💵 Tiền mặt' },
                { v: 'transfer', l: '📱 Chuyển khoản' },
                { v: 'card', l: '💳 Thẻ' },
              ].map((m) => (
                <button
                  key={m.v}
                  onClick={() => setMethod(m.v)}
                  className={clsx(
                    'py-2 rounded-xl border-2 text-sm font-medium transition-colors',
                    method === m.v
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {m.l}
                </button>
              ))}
            </div>
          </div>

          {/* Tiền mặt */}
          {method === 'cash' && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Tiền khách đưa
              </p>
              <input
                type="number"
                value={received || ''}
                onChange={(e) => setReceived(Number(e.target.value))}
                placeholder="Nhập số tiền..."
                className="w-full border rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-1.5 flex-wrap">
                {quickAmounts(final).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setReceived(amt)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs border transition-colors',
                      received === amt
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50',
                    )}
                  >
                    {amt.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer tổng kết */}
        <div className="border-t px-5 py-3 bg-gray-50 rounded-b-2xl shrink-0">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-500">Tổng cộng</span>
            <span className="text-sm line-through text-gray-400">
              {total.toLocaleString('vi-VN')}đ
            </span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-green-600">Giảm giá</span>
              <span className="text-sm text-green-600 font-medium">
                −{discount.toLocaleString('vi-VN')}đ
              </span>
            </div>
          )}
          <div className="flex justify-between items-center mb-2">
            <span className="font-black text-gray-900">Thanh toán</span>
            <span className="font-black text-2xl text-gray-900">
              {final.toLocaleString('vi-VN')}đ
            </span>
          </div>
          {method === 'cash' && received >= final && (
            <div className="flex justify-between text-green-600 font-medium mb-2 text-sm">
              <span>Tiền thừa</span>
              <span>{change.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          {method === 'cash' && received > 0 && received < final && (
            <div className="text-red-500 text-xs mb-2">
              ⚠️ Còn thiếu {(final - received).toLocaleString('vi-VN')}đ
            </div>
          )}
          <button
            onClick={handlePay}
            disabled={submitting || !enough}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-black py-3 rounded-xl text-base transition-colors"
          >
            {submitting ? 'Đang xử lý...' : '✓ Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline Item Control Popup ─────────────────────────────────
function ItemControlPopup({
  item,
  isAfterKitchen,
  onClose,
  onUpdate,
}: {
  item: OrderItem
  isAfterKitchen: boolean
  onClose: () => void
  onUpdate: (action: 'add' | 'reduce', qty: number, reason: string, notes: string) => void
}) {
  const [mode, setMode] = useState<'reduce' | 'add'>('reduce')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [notes, setNotes] = useState(item.notes ?? '')

  const finalReason = reason === 'Tự ghi lý do' ? customReason : reason
  const canConfirm = mode === 'add' || (mode === 'reduce' && finalReason.trim())

  return (
    <div className="absolute left-0 right-0 mt-1 bg-[#1e1e3a] border border-white/20 rounded-xl p-3 z-40 shadow-2xl">
      {/* Tab add/reduce */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode('reduce')}
          className={clsx(
            'flex-1 py-1 rounded-lg text-xs font-bold transition-colors',
            mode === 'reduce' ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50',
          )}
        >
          − Giảm / Hủy
        </button>
        <button
          onClick={() => setMode('add')}
          className={clsx(
            'flex-1 py-1 rounded-lg text-xs font-bold transition-colors',
            mode === 'add' ? 'bg-green-500 text-white' : 'bg-white/10 text-white/50',
          )}
        >
          + Thêm
        </button>
      </div>

      {/* Số lượng */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm"
        >
          −
        </button>
        <span className="text-white font-bold text-base w-6 text-center">{qty}</span>
        <button
          onClick={() =>
            setQty((q) => (mode === 'reduce' ? Math.min(item.quantity, q + 1) : q + 1))
          }
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm"
        >
          +
        </button>
        {mode === 'reduce' && item.quantity > 1 && (
          <button
            onClick={() => setQty(item.quantity)}
            className="text-xs text-red-400 hover:underline ml-1"
          >
            Hủy hết
          </button>
        )}
      </div>

      {/* Lý do (chỉ khi reduce) */}
      {mode === 'reduce' && (
        <div className="mb-3">
          <p className="text-xs text-white/50 mb-1">Lý do hủy:</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={clsx(
                  'px-2 py-1 rounded-lg text-xs border transition-colors',
                  reason === r
                    ? 'bg-white text-gray-900 border-white'
                    : 'bg-white/10 border-white/10 text-white/70 hover:bg-white/20',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === 'Tự ghi lý do' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Nhập lý do..."
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/50"
            />
          )}
        </div>
      )}

      {/* Ghi chú món */}
      <div className="mb-3">
        <p className="text-xs text-white/50 mb-1">Ghi chú món:</p>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ít cay, không hành..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/50"
        />
      </div>

      {isAfterKitchen && (
        <p className="text-xs text-orange-400 mb-2">⚠️ Đã báo bếp — sẽ tự động gửi thông báo</p>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs"
        >
          Huỷ
        </button>
        <button
          onClick={() => {
            if (canConfirm) onUpdate(mode, qty, finalReason, notes)
          }}
          disabled={!canConfirm}
          className={clsx(
            'flex-1 py-1.5 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-40',
            mode === 'reduce' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600',
          )}
        >
          Xác nhận
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function WaiterPOSPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [activeCategory, setCategory] = useState('Tất cả')
  const [searchQuery, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [currentOrder, setCurrentOrder] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTo, setTransferTo] = useState<Table | null>(null)
  const [tableNote, setTableNote] = useState('')
  const [showNotePopup, setShowNotePopup] = useState(false)
  const [activeItemPopup, setActiveItemPopup] = useState<number | null>(null)
  const noteTimer = useRef<any>(null)

  useEffect(() => {
    loadTables()
    loadProducts()
  }, [])

  async function loadTables() {
    const res = await fetch('/api/tables')
    const json = await res.json()
    if (res.ok) setTables(json.data)
  }

  async function loadProducts() {
    const res = await fetch('/api/products')
    const json = await res.json()
    if (res.ok) setProducts(json.data)
  }

  async function loadOrder(orderId: number) {
    const res = await fetch(`/api/orders/${orderId}`)
    const json = await res.json()
    if (res.ok) {
      setOrderItems(json.data.order_items.filter((i: any) => i.quantity > 0))
      setCurrentOrder(json.data)
      setTableNote(json.data.note ?? '')
    }
  }

  async function handleSelectTable(table: Table) {
    setSelectedTable(table)
    setCart([])
    setActiveItemPopup(null)
    if (table.activeOrder) {
      await loadOrder(table.activeOrder.id)
    } else {
      setOrderItems([])
      setCurrentOrder(null)
      setTableNote('')
    }
  }

  // Autosave ghi chú bàn
  function handleTableNoteChange(val: string) {
    setTableNote(val)
    if (!currentOrder) return
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(async () => {
      await fetch(`/api/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: val }),
      })
    }, 800)
  }

  function addToCart(product: Product) {
    if (!selectedTable) return toast.error('Chọn bàn trước!')

    // Có variants → mở popup chọn size trước
    if (product.variants?.length > 0) {
      setVariantProduct(product)
      return
    }

    addToCartWithVariant(product, null)
  }

  function addToCartWithVariant(product: Product, variant: ProductVariant | null) {
    if (!selectedTable) return

    const price = variant ? variant.price : product.price
    const name = variant ? `${product.name} (${variant.name})` : product.name
    const variantId = variant?.id ?? null
    const variantName = variant?.name ?? null
    const key = `${product.id}-${variantId ?? 'base'}`

    // Kiểm tra món đã có trong orderItems (DB) — chỉ match khi cùng variantId
    const existingInOrder = orderItems.find(
      (i) => i.products?.id === product.id && (i as any).variant_id === variantId,
    )
    if (existingInOrder) {
      handleItemUpdate(existingInOrder, 'add', 1, '', existingInOrder.notes ?? '')
      return
    }

    setCart((prev) => {
      const ex = prev.find((i) => `${i.productId}-${i.variantId ?? 'base'}` === key)
      if (ex)
        return prev.map((i) =>
          `${i.productId}-${i.variantId ?? 'base'}` === key
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        )
      return [
        ...prev,
        { productId: product.id, variantId, variantName, name, price, quantity: 1, notes: '' },
      ]
    })
  }

  // Lưu order tự động khi có món mới và bấm báo bếp
  async function ensureOrder(): Promise<number | null> {
    if (!selectedTable) return null
    if (cart.length === 0 && currentOrder) return currentOrder.id

    if (!currentOrder) {
      if (cart.length === 0) return null
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          items: cart.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            variantName: i.variantName,
            quantity: i.quantity,
            notes: i.notes,
          })),
          note: tableNote,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error)
        return null
      }
      setCart([])
      await loadOrder(json.data.orderId)
      await loadTables()
      return json.data.orderId
    } else {
      if (cart.length > 0) {
        const res = await fetch(`/api/orders/${currentOrder.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((i) => ({
              productId: Number(i.productId), // Ép kiểu số
              variantId: i.variantId ? Number(i.variantId) : null, // Ép kiểu số nếu có size
              // variantName này Backend sẽ dùng để lưu snapshot, nên gửi đi luôn
              variantName: i.variantName || null,
              quantity: i.quantity,
              notes: i.notes || '',
            })),
            sendToKitchen: false,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error)
          return null
        }
        setCart([])
        await loadOrder(currentOrder.id)
      }
      return currentOrder.id
    }
  }

  async function handleSendToKitchen() {
    setLoading(true)
    try {
      const orderId = await ensureOrder()
      if (!orderId) return
      const res = await fetch('/api/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)
      toast.success('Đã báo bếp!')
      await loadOrder(orderId)
      await loadTables()
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment() {
    setLoading(true)
    try {
      // Tự động báo bếp nếu chưa báo
      const orderId = await ensureOrder()
      if (!orderId) return
      const order = currentOrder
      if (order && order.status === 'pending') {
        const res = await fetch('/api/kitchen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
        if (!res.ok) {
          const j = await res.json()
          toast.error(j.error)
          return
        }
        await loadOrder(orderId)
      }
      setShowPayment(true)
    } finally {
      setLoading(false)
    }
  }

  // Xử lý update từ item popup
  async function handleItemUpdate(
    item: OrderItem,
    action: 'add' | 'reduce',
    qty: number,
    reason: string,
    notes: string,
  ) {
    if (!currentOrder) return
    setActiveItemPopup(null)
    setLoading(true)
    const isAfterKitchen = !['pending'].includes(currentOrder.status)

    try {
      if (action === 'reduce') {
        const res = await fetch(`/api/orders/${currentOrder.id}/items/${item.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancelQty: qty, reason }),
        })
        const json = await res.json()
        if (!res.ok) return toast.error(json.error)
        toast.success(json.data.message)
        if (json.data.action === 'order_cancelled') {
          setSelectedTable(null)
          setCurrentOrder(null)
          setOrderItems([])
          setCart([])
          await loadTables()
          return
        }
      } else {
        // Thêm món
        const res = await fetch(`/api/orders/${currentOrder.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                productId: item.products!.id,
                // THÊM DÒNG NÀY: Lấy variant_id từ chính cái item đang bấm
                variantId: (item as any).variant_id || null,
                quantity: qty,
                notes,
              },
            ],
            sendToKitchen: isAfterKitchen,
          }),
        })
        const json = await res.json()
        if (!res.ok) return toast.error(json.error)
        toast.success(isAfterKitchen ? 'Đã thêm & báo bếp!' : 'Đã thêm món!')
      }

      // Update notes nếu thay đổi
      if (notes !== item.notes) {
        await fetch(`/api/orders/${currentOrder.id}/items/${item.id}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        })
      }

      await loadOrder(currentOrder.id)
      await loadTables()
    } finally {
      setLoading(false)
    }
  }

  async function handleTransferTable() {
    if (!currentOrder || !transferTo) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTableId: transferTo.id }),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error)
      toast.success(`Đã chuyển sang bàn ${transferTo.table_number}!`)
      setShowTransfer(false)
      setTransferTo(null)
      setSelectedTable(null)
      setCurrentOrder(null)
      setOrderItems([])
      setCart([])
      await loadTables()
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    'Tất cả',
    ...Array.from(new Set(products.map((p) => p.categories?.name ?? 'Khác'))),
  ]
  const filteredProducts = products.filter((p) => {
    const matchCat = activeCategory === 'Tất cả' || p.categories?.name === activeCategory
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const savedTotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
  const cartTotal = cart.reduce((s, i) => {
    return s + i.price * i.quantity
  }, 0)
  const grandTotal = savedTotal + cartTotal
  const isAfterKitchen = currentOrder && !['pending'].includes(currentOrder.status)

  return (
    <div
      className="flex h-[calc(100vh-56px)] bg-[#1a1a2e] text-white overflow-hidden"
      onClick={() => setActiveItemPopup(null)}
    >
      {/* ── CỘT TRÁI: Order ── */}
      <div
        className="w-[500px] flex flex-col border-r border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bàn đang chọn */}
        <div className="px-3 py-2 bg-[#0d0d1a] border-b border-white/10 flex items-center justify-between shrink-0">
          {selectedTable ? (
            <>
              <div>
                <span className="font-bold text-[#00d4ff] text-base">
                  Bàn {selectedTable.table_number}
                </span>
                {currentOrder && (
                  <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/50">
                    {STATUS_LABEL[currentOrder.status]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Nút ghi chú bàn */}
                <button
                  onClick={() => setShowNotePopup(true)}
                  className={clsx(
                    'text-xs px-2 py-1 rounded-lg border transition-colors',
                    tableNote
                      ? 'border-yellow-500 text-yellow-400'
                      : 'border-white/20 text-white/40 hover:text-white/70',
                  )}
                >
                  📝 {tableNote ? 'Có ghi chú' : 'Ghi chú'}
                </button>
                <button
                  onClick={() => {
                    setSelectedTable(null)
                    setCart([])
                    setOrderItems([])
                    setCurrentOrder(null)
                  }}
                  className="text-white/30 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <span className="text-white/30 text-sm">← Chọn bàn bên phải</span>
          )}
        </div>

        {/* Danh sách món đã order */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {orderItems.length === 0 && cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20">
              <p className="text-4xl mb-2">🍽️</p>
              <p className="text-sm">Chưa có món nào</p>
            </div>
          ) : (
            <>
              {/* Món đã lưu trong DB */}
              {orderItems.map((item, idx) => {
                // 1. Tính đơn giá thực tế từ subtotal để luôn chính xác với DB
                const unitPrice = item.quantity > 0 ? item.subtotal / item.quantity : 0

                return (
                  <div key={item.id} className="relative" onClick={(e) => e.stopPropagation()}>
                    <div
                      className={clsx(
                        'flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm bg-white/5',
                        activeItemPopup === item.id && 'bg-white/10 ring-1 ring-white/20',
                      )}
                    >
                      <span className="text-white/30 text-xs w-4 mt-0.5">{idx + 1}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col">
                          <p className="text-white/90 font-medium text-xs truncate">
                            {item.products?.name}
                            {/* 2. Hiển thị Variant Name nếu có */}

                            {item.variant_name && (
                              <span className="ml-1 text-[#00d4ff] font-medium text-[10px]">
                                ({item.variant_name})
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40">
                              {(unitPrice / 1000).toFixed(0)}k
                            </span>
                            {item.notes && (
                              <p className="text-yellow-400/60 text-[10px] truncate">
                                📝 {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nút +/- */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setActiveItemPopup(activeItemPopup === item.id ? null : item.id)
                          }
                          className="w-5 h-5 rounded bg-white/10 hover:bg-red-500/30 text-white/70 text-xs font-bold"
                        >
                          −
                        </button>

                        <span className="text-xs text-white/80 w-4 text-center">
                          {item.quantity}
                        </span>

                        <button
                          onClick={async () => {
                            if (!currentOrder) return
                            setLoading(true)
                            const res = await fetch(`/api/orders/${currentOrder.id}/items`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                items: [
                                  {
                                    productId: item.products!.id,
                                    // 3. FIX: Gửi kèm variant_id để không bị nhảy về size mặc định
                                    variantId: (item as any).variant_id || null,
                                    quantity: 1,
                                    notes: item.notes ?? '',
                                  },
                                ],
                                sendToKitchen: !!isAfterKitchen,
                              }),
                            })

                            const json = await res.json()
                            if (!res.ok) {
                              toast.error(json.error)
                            } else {
                              toast.success(isAfterKitchen ? 'Đã thêm & báo bếp!' : 'Đã thêm!')
                              await Promise.all([loadOrder(currentOrder.id), loadTables()])
                            }
                            setLoading(false)
                          }}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-green-500/30 text-white/70 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <p className="text-[#00d4ff] text-xs font-bold shrink-0 ml-1">
                        {item.subtotal.toLocaleString('vi-VN')}đ
                      </p>
                    </div>

                    {/* Inline popup cho các tác vụ nâng cao (giảm món, hủy món) */}
                    {activeItemPopup === item.id && (
                      <ItemControlPopup
                        item={item}
                        isAfterKitchen={!!isAfterKitchen}
                        onClose={() => setActiveItemPopup(null)}
                        onUpdate={(action, qty, reason, notes) =>
                          handleItemUpdate(item, action, qty, reason, notes)
                        }
                      />
                    )}
                  </div>
                )
              })}
              {/* Món trong cart (chưa lưu) */}
              {cart.map((item, idx) => (
                <div
                  key={`${item.productId}-${item.variantId ?? 'base'}`}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm bg-[#003366]/40 border border-[#0066cc]/30"
                >
                  <span className="text-white/30 text-xs w-4 mt-0.5">
                    {orderItems.length + idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 font-medium text-xs truncate">{item.name}</p>

                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.productId === item.productId &&
                            (i.variantId ?? null) === (item.variantId ?? null)
                              ? { ...i, notes: e.target.value }
                              : i,
                          ),
                        )
                      }
                      placeholder="Ghi chú..."
                      className="w-full bg-transparent text-xs text-yellow-400/70 placeholder-white/20 focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.productId === item.productId &&
                            (i.variantId ?? null) === (item.variantId ?? null)
                              ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                              : i,
                          ),
                        )
                      }
                      className="w-5 h-5 rounded bg-white/10 hover:bg-red-500/30 text-white/70 text-xs font-bold"
                    >
                      −
                    </button>

                    <span className="text-xs text-white/80 w-4 text-center">{item.quantity}</span>

                    <button
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.productId === item.productId &&
                            (i.variantId ?? null) === (item.variantId ?? null)
                              ? { ...i, quantity: i.quantity + 1 }
                              : i,
                          ),
                        )
                      }
                      className="w-5 h-5 rounded bg-white/10 hover:bg-green-500/30 text-white/70 text-xs font-bold"
                    >
                      +
                    </button>
                  </div>

                  <p className="text-[#00d4ff] text-xs font-bold shrink-0">
                    {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                  </p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Tổng tiền */}
        <div className="border-t border-white/10 px-3 py-2 bg-[#0d0d1a] shrink-0">
          {cart.length > 0 && (
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Món mới</span>
              <span className="text-[#00d4ff]">+{cartTotal.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Tổng cộng</span>
            <span className="text-xl font-bold text-white">
              {grandTotal.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#0d0d1a] border-t border-white/10 shrink-0">
          <button
            onClick={handleSendToKitchen}
            disabled={loading || !selectedTable || (cart.length === 0 && !currentOrder)}
            className="col-span-2 bg-[#ff6600] hover:bg-[#ff7700] disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            🔔 {cart.length > 0 ? 'Lưu & Báo chế biến' : 'Báo chế biến'} [F9]
          </button>
          <button
            onClick={() => setShowTransfer(true)}
            disabled={!currentOrder}
            className="bg-[#444455] hover:bg-[#555566] disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs"
          >
            🔄 Chuyển bàn
          </button>
          <button
            onClick={() => toast('Tính năng đang phát triển')}
            disabled={!currentOrder}
            className="bg-[#444455] hover:bg-[#555566] disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs"
          >
            ✂️ Tách bàn
          </button>
          <button
            onClick={handlePayment}
            disabled={loading || !currentOrder || grandTotal === 0}
            className="col-span-2 bg-[#cc0000] hover:bg-[#dd0000] disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            💳 Thanh toán [F4]
          </button>
        </div>
      </div>

      {/* ── CỘT PHẢI: Bàn + Menu ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="px-3 py-2 bg-[#0d0d1a] border-b border-white/10 shrink-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm thực đơn - F1"
              className="w-full bg-white/10 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#0066cc]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Grid bàn */}
        <div className="p-2 border-b border-white/10 shrink-0">
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {tables.map((table) => {
              const isSelected = selectedTable?.id === table.id
              return (
                <button
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
                  className={clsx(
                    'py-1.5 px-1 rounded-lg border text-xs font-bold transition-all',
                    isSelected ? TABLE_STYLE.selected : TABLE_STYLE[table.status],
                  )}
                >
                  <p>{table.table_number}</p>
                  {table.activeOrder && (
                    <p className="text-[10px] font-normal opacity-70">
                      {(table.activeOrder.total_price / 1000).toFixed(0)}k
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3">
            {[
              { c: 'bg-[#1a6b3c]', l: 'Trống' },
              { c: 'bg-[#6b1a1a]', l: 'Có khách' },
              { c: 'bg-[#7a4a00]', l: 'Đặt trước' },
              { c: 'bg-[#0066cc]', l: 'Đang chọn' },
            ].map((l) => (
              <div key={l.l} className="flex items-center gap-1">
                <span className={clsx('w-2.5 h-2.5 rounded', l.c)} />
                <span className="text-[10px] text-white/30">{l.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-white/10 bg-[#0d0d1a] shrink-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat)
                setSearch('')
              }}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-colors',
                activeCategory === cat && !searchQuery
                  ? 'bg-[#0066cc] text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid món */}
        <div className="flex-1 overflow-y-auto p-2">
          {searchQuery && (
            <p className="text-xs text-white/30 mb-2 px-1">
              "{searchQuery}": {filteredProducts.length} món
            </p>
          )}
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
            {filteredProducts.map((product) => {
              const inCartQty = cart
                .filter((i) => i.productId === product.id)
                .reduce((sum, i) => sum + i.quantity, 0)
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={clsx(
                    'p-2 rounded-lg border text-left transition-all active:scale-95 flex flex-col justify-between h-full',
                    inCartQty > 0
                      ? 'bg-[#003366] border-[#0066cc]' // Màu khi đã chọn
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                  )}
                >
                  <div className="flex gap-2 w-full">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white">{product.name}</p>
                      <p className="text-xs font-bold text-[#00d4ff]">
                        {(product.price / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <div className="w-12 h-12 shrink-0">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-md"
                      />
                    </div>
                  </div>

                  {/* Hiển thị tổng số lượng (bao gồm tất cả variant của món đó) */}
                  {inCartQty > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full text-white font-bold">
                        ×{inCartQty}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {variantProduct && (
        <VariantPicker
          product={variantProduct}
          onSelect={(v) => {
            addToCartWithVariant(variantProduct, v)
            setVariantProduct(null)
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}
      {/* ── Modal Ghi chú bàn ── */}
      {showNotePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-white mb-3">
              📝 Ghi chú bàn {selectedTable?.table_number}
            </h3>
            <textarea
              value={tableNote}
              onChange={(e) => handleTableNoteChange(e.target.value)}
              placeholder="Ghi chú cho hóa đơn này..."
              rows={4}
              autoFocus
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotePopup(false)}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleTableNoteChange(tableNote)
                  setShowNotePopup(false)
                  toast.success('Đã lưu ghi chú!')
                }}
                className="flex-1 py-2 rounded-xl bg-[#0066cc] text-white font-bold text-sm"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Chuyển bàn ── */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md p-5">
            <h3 className="font-bold text-white text-lg mb-4">
              Chuyển bàn — <span className="text-[#00d4ff]">{selectedTable?.table_number}</span>
            </h3>
            <p className="text-white/50 text-sm mb-3">Chọn bàn đích:</p>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {tables
                .filter((t) => t.id !== selectedTable?.id)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTransferTo(t)}
                    className={clsx(
                      'py-2 rounded-lg border text-xs font-bold transition-colors',
                      transferTo?.id === t.id
                        ? 'bg-[#0066cc] border-[#0088ff] text-white'
                        : t.status === 'available'
                          ? 'bg-[#1a6b3c] border-[#1d7d46] text-white hover:bg-[#1d7d46]'
                          : t.status === 'occupied'
                            ? 'bg-[#6b1a1a] border-[#7d1d1d] text-white hover:bg-[#7d1d1d]'
                            : 'bg-[#7a4a00] border-[#8a5500] text-white hover:bg-[#8a5500]',
                    )}
                  >
                    <p>{t.table_number}</p>
                    {t.activeOrder && (
                      <p className="text-[10px] opacity-60">
                        {(t.activeOrder.total_price / 1000).toFixed(0)}k
                      </p>
                    )}
                  </button>
                ))}
            </div>
            <div className="flex gap-3 mb-4 text-[10px] text-white/40">
              <span>
                <span className="inline-block w-2 h-2 rounded bg-[#1a6b3c] mr-1" />
                Trống
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded bg-[#6b1a1a] mr-1" />
                Có khách
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded bg-[#7a4a00] mr-1" />
                Đặt trước
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransfer(false)
                  setTransferTo(null)
                }}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm"
              >
                Huỷ
              </button>
              <button
                onClick={handleTransferTable}
                disabled={!transferTo || loading}
                className="flex-1 py-2 rounded-xl bg-[#0066cc] text-white font-bold text-sm disabled:opacity-40"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayment && currentOrder && selectedTable && (
        <PaymentModal
          orderId={currentOrder.id}
          tableNumber={selectedTable.table_number}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false)
            setSelectedTable(null)
            setCurrentOrder(null)
            setOrderItems([])
            setCart([])
            loadTables()
          }}
        />
      )}
    </div>
  )
}
