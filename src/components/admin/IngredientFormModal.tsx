// src/components/admin/IngredientFormModal.tsx
// Modal thêm / sửa nguyên liệu
// Props: ingredient (null = thêm mới), onClose, onSaved

'use client'
import { useEffect, useState } from 'react'
import { Ingredient } from '@/hooks/useIngredients'

// Danh sách đơn vị phổ biến gợi ý cho người dùng
const COMMON_UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'hộp', 'túi', 'bó', 'chai', 'lon']

interface Props {
  ingredient: Ingredient | null // null = thêm mới, có giá trị = sửa
  onClose: () => void
  onSaved: () => void
}

export default function IngredientFormModal({ ingredient, onClose, onSaved }: Props) {
  const isEdit = !!ingredient

  const [form, setForm] = useState({
    name:            ingredient?.name ?? '',
    unit:            ingredient?.unit ?? '',
    stock_quantity:  ingredient?.stock_quantity ?? 0,
    min_stock_level: ingredient?.min_stock_level ?? 5,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Đóng modal bằng phím Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  /**
   * handleSubmit — validate form rồi gọi API thêm hoặc sửa nguyên liệu
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim())   { setError('Tên nguyên liệu không được trống'); return }
    if (!form.unit.trim())   { setError('Đơn vị không được trống'); return }
    if (form.stock_quantity < 0)  { setError('Tồn kho không được âm'); return }
    if (form.min_stock_level < 0) { setError('Mức tối thiểu không được âm'); return }

    setSaving(true)
    const payload = isEdit ? { id: ingredient!.id, ...form } : form
    const res  = await window.fetch('/api/ingredients', {
      method:  isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) setError(json.error ?? 'Có lỗi xảy ra')
    else onSaved()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold'>
            {isEdit ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}
          </h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>

        <form onSubmit={handleSubmit} className='px-6 py-4 space-y-4'>
          {error && (
            <div className='bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg'>{error}</div>
          )}

          {/* Tên nguyên liệu */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Tên nguyên liệu *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='VD: Thịt bò, Bánh phở, Hành lá...'
            />
          </div>

          {/* Đơn vị */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Đơn vị *</label>
            <div className='flex gap-2 flex-wrap mb-2'>
              {/* Gợi ý đơn vị phổ biến */}
              {COMMON_UNITS.map((u) => (
                <button
                  key={u}
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, unit: u }))}
                  className={`px-2 py-1 text-xs rounded-lg border transition ${
                    form.unit === u
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <input
              className={inputCls}
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder='Hoặc nhập đơn vị khác...'
            />
          </div>

          {/* Tồn kho + Mức tối thiểu */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Tồn kho hiện tại</label>
              <input
                type='number'
                className={inputCls}
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: Number(e.target.value) }))}
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Mức tối thiểu
                <span className='text-xs text-gray-400 ml-1'>(cảnh báo khi dưới)</span>
              </label>
              <input
                type='number'
                className={inputCls}
                value={form.min_stock_level}
                onChange={(e) => setForm((f) => ({ ...f, min_stock_level: Number(e.target.value) }))}
                min={0}
                step={0.1}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className='flex gap-3 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition'
            >
              Hủy
            </button>
            <button
              type='submit'
              disabled={saving}
              className='flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50'
            >
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}