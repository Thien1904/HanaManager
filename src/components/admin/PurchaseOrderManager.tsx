// src/components/admin/PurchaseOrderManager.tsx
// Trang nhập nguyên liệu — tạo đơn nhập, xác nhận nhận hàng, xem lịch sử
// Khi xác nhận completed → API tự động cộng vào stock_quantity

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useIngredients } from '@/hooks/useIngredients'
import { cls, filterTab } from '@/utils/styles'

// Kiểu nhà cung cấp
interface Supplier {
  id:           number
  name:         string
  contact_name: string | null
  phone:        string | null
}

// Kiểu 1 dòng trong đơn nhập
interface PurchaseItem {
  ingredientId:   number
  ingredientName: string
  unit:           string
  quantity:       number
  unitPrice:      number
}

// Kiểu đơn nhập từ API
interface PurchaseOrder {
  id:           number
  total_amount: number
  status:       'pending' | 'completed' | 'cancelled'
  created_at:   string
  suppliers:    { id: number; name: string; phone: string | null } | null
  users:        { id: number; full_name: string } | null
  purchase_order_items: {
    id:         number
    quantity:   number
    unit_price: number
    ingredients: { id: number; name: string; unit: string } | null
  }[]
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Chờ xử lý', cls: 'bg-yellow-100 text-yellow-700' },
  completed:  { label: 'Đã nhận',   cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Đã hủy',    cls: 'bg-gray-100 text-gray-500' },
}

export default function PurchaseOrderManager() {
  const { ingredients, refresh: refreshIngredients } = useIngredients()

  const [orders, setOrders]       = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all')

  // State tạo đơn mới
  const [showCreate, setShowCreate]   = useState(false)
  const [supplierId, setSupplierId]   = useState<number>(0)
  const [items, setItems]             = useState<PurchaseItem[]>([])
  const [pickIngId, setPickIngId]     = useState<number>(0)
  const [pickQty, setPickQty]         = useState<string>('')
  const [pickPrice, setPickPrice]     = useState<string>('')
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  // State supplier modal
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [newSupplierName, setNewSupplierName]   = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [newSupplierContact, setNewSupplierContact] = useState('')

  /**
   * loadData — fetch đơn nhập và nhà cung cấp song song
   */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ordersRes, suppliersRes] = await Promise.all([
        window.fetch('/api/purchase-orders'),
        window.fetch('/api/suppliers'),
      ])
      const [ordersJson, suppliersJson] = await Promise.all([
        ordersRes.json(),
        suppliersRes.json(),
      ])
      if (ordersRes.ok)    setOrders(ordersJson.data)
      if (suppliersRes.ok) setSuppliers(suppliersJson.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /**
   * handleAddItem — thêm 1 nguyên liệu vào đơn đang tạo
   */
  function handleAddItem() {
    setFormError('')
    if (!pickIngId)                       { setFormError('Chọn nguyên liệu'); return }
    if (!pickQty || parseFloat(pickQty) <= 0) { setFormError('Số lượng phải lớn hơn 0'); return }
    if (pickPrice === '' || parseFloat(pickPrice) < 0) { setFormError('Đơn giá không hợp lệ'); return }
    if (items.find((i) => i.ingredientId === pickIngId)) { setFormError('Nguyên liệu này đã có trong đơn'); return }

    const ing = ingredients.find((i) => i.id === pickIngId)!
    setItems((prev) => [...prev, {
      ingredientId:   ing.id,
      ingredientName: ing.name,
      unit:           ing.unit,
      quantity:       parseFloat(pickQty),
      unitPrice:      parseFloat(pickPrice) || 0,
    }])
    setPickIngId(0)
    setPickQty('')
    setPickPrice('')
  }

  /**
   * handleCreateOrder — tạo đơn nhập mới, gửi lên API
   */
  async function handleCreateOrder() {
    setFormError('')
    if (!supplierId)    { setFormError('Chọn nhà cung cấp'); return }
    if (!items.length)  { setFormError('Thêm ít nhất 1 nguyên liệu'); return }

    setSaving(true)
    try {
      const res  = await window.fetch('/api/purchase-orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          items: items.map((i) => ({
            ingredient_id: i.ingredientId,
            quantity:      i.quantity,
            unit_price:    i.unitPrice,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error); return }

      // Reset form và reload
      setShowCreate(false)
      setSupplierId(0)
      setItems([])
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  /**
   * handleConfirmcompleted — xác nhận đã nhận hàng → cộng tồn kho
   */
  async function handleConfirmCompleted(id: number) {
    if (!confirm('Xác nhận đã nhận hàng? Tồn kho sẽ được cộng vào ngay.')) return
    const res  = await window.fetch('/api/purchase-orders', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, status: 'completed' }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error)
    else {
      await loadData()
      refreshIngredients() // Refresh tồn kho trong trang ingredients nếu đang mở
    }
  }

  /**
   * handleCancel — hủy đơn nhập đang chờ
   */
  async function handleCancel(id: number) {
    if (!confirm('Hủy đơn nhập này?')) return
    await window.fetch('/api/purchase-orders', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, status: 'cancelled' }),
    })
    await loadData()
  }

  /**
   * handleDelete — xóa đơn nhập đang pending
   */
  async function handleDelete(id: number) {
    if (!confirm('Xóa đơn nhập này?')) return
    await window.fetch('/api/purchase-orders', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    await loadData()
  }

  /**
   * handleAddSupplier — thêm nhà cung cấp mới nhanh
   */
  async function handleAddSupplier() {
    if (!newSupplierName.trim()) return
    const res  = await window.fetch('/api/suppliers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:         newSupplierName.trim(),
        phone:        newSupplierPhone.trim() || null,
        contact_name: newSupplierContact.trim() || null,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setSuppliers((prev) => [...prev, json.data])
      setSupplierId(json.data.id)
      setShowSupplierForm(false)
      setNewSupplierName('')
      setNewSupplierPhone('')
      setNewSupplierContact('')
    }
  }

  // Filter đơn theo status
  const filteredOrders = orders.filter(
    (o) => filterStatus === 'all' || o.status === filterStatus
  )

  // Tổng tiền đơn đang tạo
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  // Nguyên liệu chưa có trong đơn đang tạo
  const availableIngredients = ingredients.filter(
    (i) => !items.find((item) => item.ingredientId === i.id)
  )

  return (
    <div className='p-6 max-w-6xl mx-auto space-y-8'>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-gray-900'>Nhập nguyên liệu</h1>
          <p className='text-sm text-gray-500 mt-1'>
            {orders.filter((o) => o.status === 'pending').length} đơn đang chờ xử lý
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={cls.btnPrimary}
        >
          + Tạo đơn nhập
        </button>
      </div>

      {/* ── Form tạo đơn nhập mới ── */}
      {showCreate && (
        <div className='p-5 bg-orange-50 border border-orange-200 rounded-xl space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='font-semibold text-gray-900'>Tạo đơn nhập mới</h2>
            <button onClick={() => { setShowCreate(false); setItems([]); setFormError('') }}
              className='text-gray-400 hover:text-gray-600'>✕</button>
          </div>

          {formError && <p className='text-xs text-red-500'>{formError}</p>}

          {/* Chọn nhà cung cấp */}
          <div className='flex items-center gap-3'>
            <div className='flex-1'>
              <label className={cls.label}>Nhà cung cấp *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}
                className={cls.select}>
                <option value={0}>-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `· ${s.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className='mt-5'>
              <button onClick={() => setShowSupplierForm(!showSupplierForm)}
                className='px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition'>
                + Thêm NCC
              </button>
            </div>
          </div>

          {/* Form thêm NCC nhanh */}
          {showSupplierForm && (
            <div className='p-3 bg-white border border-gray-200 rounded-lg space-y-2'>
              <p className='text-xs font-medium text-gray-600'>Thêm nhà cung cấp mới:</p>
              <div className='grid grid-cols-3 gap-2'>
                <input className={cls.input} placeholder='Tên NCC *' value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)} />
                <input className={cls.input} placeholder='SĐT' value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)} />
                <input className={cls.input} placeholder='Người liên hệ' value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)} />
              </div>
              <div className='flex gap-2'>
                <button onClick={handleAddSupplier} className={cls.btnPrimary}>Lưu NCC</button>
                <button onClick={() => setShowSupplierForm(false)} className={cls.btnSecondary}>Hủy</button>
              </div>
            </div>
          )}

          {/* Thêm nguyên liệu vào đơn */}
          <div>
            <label className={cls.label}>Thêm nguyên liệu</label>
            <div className='flex items-center gap-2 flex-wrap'>
              <select value={pickIngId}
                onChange={(e) => { setPickIngId(Number(e.target.value)); setPickQty(''); setPickPrice('') }}
                className={`${cls.select} flex-1 min-w-[180px]`}>
                <option value={0}>-- Chọn nguyên liệu --</option>
                {availableIngredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>

              {pickIngId > 0 && (
                <>
                  <input type='number' value={pickQty} onChange={(e) => setPickQty(e.target.value)}
                    placeholder='Số lượng' min={0.001} step={0.001}
                    className='w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400' />
                  <input type='number' value={pickPrice} onChange={(e) => setPickPrice(e.target.value)}
                    placeholder='Đơn giá (đ)' min={0} step={1000}
                    className='w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400' />
                </>
              )}

              {pickIngId > 0 && parseFloat(pickQty) > 0 && (
                <button onClick={handleAddItem} className={cls.btnPrimary}>Add</button>
              )}
            </div>
          </div>

          {/* Danh sách nguyên liệu đã thêm */}
          {items.length > 0 && (
            <div className={cls.tableWrap}>
              <table className={cls.table}>
                <thead className={cls.thead}>
                  <tr>
                    <th className={cls.th}>Nguyên liệu</th>
                    <th className={cls.th}>Số lượng</th>
                    <th className={cls.th}>Đơn giá</th>
                    <th className={cls.th}>Thành tiền</th>
                    <th className={cls.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.ingredientId} className={cls.tr}>
                      <td className={`${cls.td} font-medium`}>{item.ingredientName}
                        <span className='text-xs text-gray-400 ml-1'>({item.unit})</span>
                      </td>
                      <td className={cls.td}>{item.quantity}</td>
                      <td className={cls.td}>{item.unitPrice.toLocaleString('vi-VN')}đ</td>
                      <td className={`${cls.td} font-medium text-orange-600`}>
                        {(item.quantity * item.unitPrice).toLocaleString('vi-VN')}đ
                      </td>
                      <td className={cls.td}>
                        <button onClick={() => setItems((prev) => prev.filter((i) => i.ingredientId !== item.ingredientId))}
                          className='text-red-400 hover:text-red-600'>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className='bg-orange-50'>
                    <td colSpan={3} className={`${cls.td} font-semibold text-right`}>Tổng:</td>
                    <td className={`${cls.td} font-bold text-orange-600`}>
                      {totalAmount.toLocaleString('vi-VN')}đ
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Nút tạo đơn */}
          {items.length > 0 && (
            <div className='flex gap-2'>
              <button onClick={handleCreateOrder} disabled={saving}
                className={`${cls.btnPrimary} disabled:opacity-50`}>
                {saving ? 'Đang tạo...' : `Tạo đơn nhập (${items.length} nguyên liệu)`}
              </button>
              <button onClick={() => { setShowCreate(false); setItems([]); setFormError('') }}
                className={cls.btnSecondary}>Hủy</button>
            </div>
          )}
        </div>
      )}

      {/* Filter trạng thái */}
      <div className='flex gap-2'>
        {(['all', 'pending', 'completed', 'cancelled'] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={filterTab(filterStatus === s)}>
            {s === 'all' ? 'Tất cả' : STATUS_LABEL[s].label}
            {s !== 'all' && (
              <span className='ml-1 text-xs'>
                ({orders.filter((o) => o.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Danh sách đơn nhập */}
      {loading ? (
        <div className='text-center py-16 text-gray-400'>Đang tải...</div>
      ) : filteredOrders.length === 0 ? (
        <div className='text-center py-16 text-gray-400'>Không có đơn nhập nào</div>
      ) : (
        <div className='space-y-3'>
          {filteredOrders.map((order) => (
            <div key={order.id} className={cls.tableWrap}>
              {/* Header đơn */}
              <div className='flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200'>
                <div className='flex items-center gap-3'>
                  <span className='font-semibold text-gray-900'>#{order.id}</span>
                  <span className='text-sm text-gray-600'>{order.suppliers?.name ?? '—'}</span>
                  {order.suppliers?.phone && (
                    <span className='text-xs text-gray-400'>{order.suppliers.phone}</span>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${STATUS_LABEL[order.status].cls}`}>
                    {STATUS_LABEL[order.status].label}
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='text-sm font-semibold text-orange-600'>
                    {order.total_amount.toLocaleString('vi-VN')}đ
                  </span>
                  <span className='text-xs text-gray-400'>
                    {new Date(order.created_at).toLocaleDateString('vi-VN')}
                  </span>
                  {/* Actions chỉ cho đơn pending */}
                  {order.status === 'pending' && (
                    <div className='flex gap-1'>
                      <button onClick={() => handleConfirmCompleted(order.id)}
                        className='px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition'>
                        ✓ Đã nhận hàng
                      </button>
                      <button onClick={() => handleCancel(order.id)}
                        className='px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition'>
                        Hủy
                      </button>
                      <button onClick={() => handleDelete(order.id)}
                        className='px-2 py-1 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition'>
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chi tiết nguyên liệu trong đơn */}
              <div className='flex flex-wrap gap-2 px-4 py-3'>
                {order.purchase_order_items.map((item) => (
                  <div key={item.id}
                    className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm'>
                    <span className='font-medium text-gray-800'>{item.ingredients?.name}</span>
                    <span className='text-gray-500 text-xs'>({item.ingredients?.unit})</span>
                    <span className='text-orange-600 font-semibold'>{item.quantity}</span>
                    {item.unit_price > 0 && (
                      <span className='text-gray-400 text-xs'>· {item.unit_price.toLocaleString('vi-VN')}đ</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}