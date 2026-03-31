// src/components/admin/TableManager.tsx
// Trang quản lý bàn ăn cho admin
// Hiển thị grid bàn giống waiter nhưng có thêm/sửa/xóa
// Bàn đang có khách (occupied) không cho sửa/xóa

'use client'
import { useState, useCallback, useEffect } from 'react'
import { cls, filterTab } from '@/utils/styles'

// Kiểu bàn từ API
interface TableItem {
  id:           number
  table_number: string
  status:       'available' | 'occupied' | 'reserved'
  activeOrder:  { id: number; total_price: number; users: { full_name: string } | null } | null
}

// Config màu theo trạng thái — dùng chung với waiter
const STATUS_CONFIG = {
  available: { bg: 'bg-white border-gray-200',      badge: 'bg-green-100 text-green-700',  label: 'Trống',      dot: 'bg-green-400' },
  occupied:  { bg: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-700',      label: 'Có khách',   dot: 'bg-red-400'   },
  reserved:  { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', label: 'Đặt trước', dot: 'bg-yellow-400' },
}

export default function TableManager() {
  const [tables, setTables]       = useState<TableItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'available' | 'occupied'>('all')

  // State form thêm/sửa bàn
  const [showForm, setShowForm]       = useState(false)
  const [editTable, setEditTable]     = useState<TableItem | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  /**
   * loadTables — fetch danh sách bàn từ API
   */
  const loadTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await window.fetch('/api/tables')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTables(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTables() }, [loadTables])

  // Stats
  const stats = {
    total:     tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied:  tables.filter((t) => t.status === 'occupied').length,
  }

  const filteredTables = tables.filter((t) =>
    filter === 'all' || t.status === filter
  )

  /**
   * openAddForm — mở form thêm bàn mới
   */
  function openAddForm() {
    setEditTable(null)
    setTableNumber('')
    setFormError('')
    setShowForm(true)
  }

  /**
   * openEditForm — mở form sửa tên bàn
   */
  function openEditForm(table: TableItem) {
    setEditTable(table)
    setTableNumber(table.table_number)
    setFormError('')
    setShowForm(true)
  }

  /**
   * handleSave — thêm hoặc sửa bàn
   */
  async function handleSave() {
    setFormError('')
    if (!tableNumber.trim()) { setFormError('Số/tên bàn không được trống'); return }

    // Kiểm tra trùng tên
    const isDuplicate = tables.some(
      (t) => t.table_number === tableNumber.trim() && t.id !== editTable?.id
    )
    if (isDuplicate) { setFormError('Tên bàn đã tồn tại'); return }

    setSaving(true)
    const res = await window.fetch('/api/tables', {
      method:  editTable ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(
        editTable
          ? { id: editTable.id, table_number: tableNumber.trim() }
          : { table_number: tableNumber.trim() }
      ),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { setFormError(json.error); return }
    setShowForm(false)
    await loadTables()
  }

  /**
   * handleDelete — xóa bàn, chỉ xóa được bàn trống
   */
  async function handleDelete(table: TableItem) {
    if (!confirm(`Xóa bàn ${table.table_number}?`)) return
    const res  = await window.fetch('/api/tables', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: table.id }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error)
    else await loadTables()
  }

  /**
   * handleBulkAdd — thêm nhiều bàn cùng lúc theo prefix + range
   * VD: "Bàn" + 1→10 → tạo Bàn 1, Bàn 2, ..., Bàn 10
   */
  const [showBulk, setShowBulk]     = useState(false)
  const [bulkPrefix, setBulkPrefix] = useState('Bàn ')
  const [bulkFrom, setBulkFrom]     = useState(1)
  const [bulkTo, setBulkTo]         = useState(10)
  const [bulkError, setBulkError]   = useState('')

  async function handleBulkAdd() {
    setBulkError('')
    if (bulkFrom > bulkTo)       { setBulkError('Từ phải nhỏ hơn Đến'); return }
    if (bulkTo - bulkFrom > 49)  { setBulkError('Tối đa 50 bàn mỗi lần'); return }

    const newNumbers = Array.from(
      { length: bulkTo - bulkFrom + 1 },
      (_, i) => `${bulkPrefix}${bulkFrom + i}`
    )

    // Loại bỏ số bàn đã tồn tại
    const existing  = new Set(tables.map((t) => t.table_number))
    const toCreate  = newNumbers.filter((n) => !existing.has(n))

    if (!toCreate.length) { setBulkError('Tất cả bàn trong dải này đã tồn tại'); return }

    setSaving(true)
    await Promise.all(
      toCreate.map((n) =>
        window.fetch('/api/tables', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ table_number: n }),
        })
      )
    )
    setSaving(false)
    setShowBulk(false)
    await loadTables()
  }

  if (error) return <div className='p-6 text-center text-red-500'>{error}</div>

  return (
    <div className='p-6 max-w-6xl mx-auto'>

      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-semibold text-gray-900'>Quản lý bàn ăn</h1>
          <p className='text-sm text-gray-500 mt-1'>
            {stats.total} bàn · {stats.available} trống · {stats.occupied} có khách
          </p>
        </div>
        <div className='flex gap-2'>
          <button onClick={() => setShowBulk(true)} className={cls.btnSecondary}>
            + Thêm nhiều bàn
          </button>
          <button onClick={openAddForm} className={cls.btnPrimary}>
            + Thêm bàn
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-3 gap-4 mb-6'>
        {[
          { label: 'Tổng số bàn',    value: stats.total,     color: 'text-gray-900',   bg: 'bg-gray-50'    },
          { label: 'Bàn trống',      value: stats.available, color: 'text-green-600',  bg: 'bg-green-50'   },
          { label: 'Đang có khách',  value: stats.occupied,  color: 'text-red-600',    bg: 'bg-red-50'     },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className='text-sm text-gray-600 mt-0.5'>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className='flex gap-2 mb-4'>
        <button onClick={() => setFilter('all')}       className={filterTab(filter === 'all')}>Tất cả</button>
        <button onClick={() => setFilter('available')} className={filterTab(filter === 'available')}>Trống</button>
        <button onClick={() => setFilter('occupied')}  className={filterTab(filter === 'occupied')}>Có khách</button>
      </div>

      {/* Grid bàn */}
      {loading ? (
        <div className='grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4'>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className='h-32 rounded-xl bg-gray-100 animate-pulse' />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className='text-center py-20 text-gray-400'>Không có bàn nào</div>
      ) : (
        <div className='grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4'>
          {filteredTables.map((table) => {
            const config    = STATUS_CONFIG[table.status]
            const canEdit   = table.status === 'available'
            return (
              <div key={table.id} className={`relative p-4 rounded-xl border-2 ${config.bg} transition`}>
                {/* Tên bàn + badge */}
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-lg font-bold text-gray-900'>{table.table_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                    {config.label}
                  </span>
                </div>

                {/* Thông tin order nếu có khách */}
                {table.activeOrder ? (
                  <div className='space-y-0.5'>
                    <p className='text-xs text-gray-500 truncate'>
                      {table.activeOrder.users?.full_name ?? '—'}
                    </p>
                    <p className='text-sm font-semibold text-gray-900'>
                      {table.activeOrder.total_price.toLocaleString('vi-VN')}đ
                    </p>
                  </div>
                ) : (
                  <p className='text-xs text-gray-400'>Chưa có order</p>
                )}

                {/* Dot trạng thái */}
                <span className={`absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full ${config.dot}`} />

                {/* Actions — chỉ hiện khi bàn trống */}
                {canEdit && (
                  <div className='flex gap-1 mt-2'>
                    <button
                      onClick={() => openEditForm(table)}
                      className='flex-1 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition'
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(table)}
                      className='flex-1 py-1 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition'
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal thêm/sửa bàn */}
      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm'>
            <div className='flex items-center justify-between px-6 py-4 border-b'>
              <h2 className='text-lg font-semibold'>
                {editTable ? `Sửa bàn ${editTable.table_number}` : 'Thêm bàn mới'}
              </h2>
              <button onClick={() => setShowForm(false)} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
            </div>
            <div className='px-6 py-4 space-y-4'>
              {formError && <p className='text-xs text-red-500'>{formError}</p>}
              <div>
                <label className={cls.label}>Số/tên bàn *</label>
                <input
                  className={cls.input}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder='VD: Bàn 1, A1, VIP 1...'
                  autoFocus
                />
                <p className='text-xs text-gray-400 mt-1'>Tên bàn hiển thị trên màn hình phục vụ</p>
              </div>
              <div className='flex gap-3'>
                <button type='button' onClick={() => setShowForm(false)} className={`flex-1 ${cls.btnSecondary}`}>Hủy</button>
                <button onClick={handleSave} disabled={saving} className={`flex-1 ${cls.btnPrimary} disabled:opacity-50`}>
                  {saving ? 'Đang lưu...' : editTable ? 'Cập nhật' : 'Thêm bàn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm nhiều bàn */}
      {showBulk && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm'>
            <div className='flex items-center justify-between px-6 py-4 border-b'>
              <h2 className='text-lg font-semibold'>Thêm nhiều bàn</h2>
              <button onClick={() => setShowBulk(false)} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
            </div>
            <div className='px-6 py-4 space-y-4'>
              {bulkError && <p className='text-xs text-red-500'>{bulkError}</p>}

              <div>
                <label className={cls.label}>Prefix (tên đầu)</label>
                <input className={cls.input} value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)} placeholder='VD: Bàn ' />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={cls.label}>Từ số</label>
                  <input type='number' className={cls.input} value={bulkFrom} min={1}
                    onChange={(e) => setBulkFrom(Number(e.target.value))} />
                </div>
                <div>
                  <label className={cls.label}>Đến số</label>
                  <input type='number' className={cls.input} value={bulkTo} min={1}
                    onChange={(e) => setBulkTo(Number(e.target.value))} />
                </div>
              </div>

              {/* Preview */}
              <p className='text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2'>
                Preview: <span className='font-medium'>{bulkPrefix}{bulkFrom}</span> →{' '}
                <span className='font-medium'>{bulkPrefix}{bulkTo}</span>
                {' '}({bulkTo - bulkFrom + 1} bàn)
              </p>

              <div className='flex gap-3'>
                <button onClick={() => setShowBulk(false)} className={`flex-1 ${cls.btnSecondary}`}>Hủy</button>
                <button onClick={handleBulkAdd} disabled={saving} className={`flex-1 ${cls.btnPrimary} disabled:opacity-50`}>
                  {saving ? 'Đang tạo...' : `Tạo ${bulkTo - bulkFrom + 1} bàn`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}