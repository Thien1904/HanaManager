// src/components/admin/RecipeModal.tsx
// Modal xem và chỉnh sửa công thức của 1 món ăn
// Hiển thị danh sách nguyên liệu, cho phép thêm/sửa/xóa từng dòng
// Props: product (món ăn đang xem), allIngredients (toàn bộ nguyên liệu để chọn), onClose

'use client'
import { useEffect, useState } from 'react'
import { Ingredient } from '@/hooks/useIngredients'

// Kiểu 1 dòng trong công thức
interface RecipeItem {
  id: number
  quantity_needed: number
  ingredients: {
    id: number
    name: string
    unit: string
    stock_quantity: number
  }
}

interface Props {
  product: { id: number; name: string }
  allIngredients: Ingredient[] // Toàn bộ nguyên liệu để chọn khi thêm mới
  onClose: () => void
}

export default function RecipeModal({ product, allIngredients, onClose }: Props) {
  const [recipes, setRecipes]   = useState<RecipeItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Form thêm nguyên liệu mới vào công thức
  const [newIngredientId, setNewIngredientId] = useState<number>(allIngredients[0]?.id ?? 0)
  const [newQty, setNewQty]                   = useState<number>(0)
  const [adding, setAdding]                   = useState(false)

  // Đóng modal bằng Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  /**
   * loadRecipes — fetch công thức của món hiện tại từ API
   */
  async function loadRecipes() {
    setLoading(true)
    try {
      const res  = await window.fetch(`/api/recipes?product_id=${product.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRecipes(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecipes() }, [product.id])

  /**
   * handleAdd — thêm 1 nguyên liệu mới vào công thức
   */
  async function handleAdd() {
    if (!newIngredientId) { setError('Chọn nguyên liệu'); return }
    if (newQty <= 0)      { setError('Số lượng phải lớn hơn 0'); return }
    setError('')
    setAdding(true)

    const res  = await window.fetch('/api/recipes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        product_id:      product.id,
        ingredient_id:   newIngredientId,
        quantity_needed: newQty,
      }),
    })
    const json = await res.json()
    setAdding(false)

    if (!res.ok) setError(json.error)
    else { setNewQty(0); loadRecipes() }
  }

  /**
   * handleUpdateQty — cập nhật số lượng 1 dòng công thức
   */
  async function handleUpdateQty(id: number, qty: number) {
    if (qty <= 0) return
    await window.fetch('/api/recipes', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, quantity_needed: qty }),
    })
    loadRecipes()
  }

  /**
   * handleDelete — xóa 1 nguyên liệu khỏi công thức
   */
  async function handleDelete(id: number) {
    if (!confirm('Xóa nguyên liệu này khỏi công thức?')) return
    await window.fetch('/api/recipes', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    loadRecipes()
  }

  // Lọc ra các nguyên liệu chưa có trong công thức để tránh trùng
  const usedIds    = new Set(recipes.map((r) => r.ingredients.id))
  const available  = allIngredients.filter((i) => !usedIds.has(i.id))

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <div>
            <h2 className='text-lg font-semibold'>Công thức món</h2>
            <p className='text-sm text-gray-500'>{product.name}</p>
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>
          {error && (
            <div className='bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg'>{error}</div>
          )}

          {/* Danh sách nguyên liệu hiện có trong công thức */}
          {loading ? (
            <div className='text-center py-10 text-gray-400'>Đang tải...</div>
          ) : recipes.length === 0 ? (
            <div className='text-center py-10 text-gray-400'>Chưa có nguyên liệu nào</div>
          ) : (
            <div className='space-y-2'>
              {recipes.map((r) => (
                <div key={r.id} className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900'>{r.ingredients.name}</p>
                    <p className='text-xs text-gray-400'>Tồn: {r.ingredients.stock_quantity} {r.ingredients.unit}</p>
                  </div>
                  {/* Input sửa số lượng trực tiếp */}
                  <input
                    type='number'
                    defaultValue={r.quantity_needed}
                    onBlur={(e) => handleUpdateQty(r.id, Number(e.target.value))}
                    min={0}
                    step={0.1}
                    className='w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400'
                  />
                  <span className='text-xs text-gray-500 w-8'>{r.ingredients.unit}</span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className='text-red-400 hover:text-red-600 text-lg leading-none'
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form thêm nguyên liệu mới */}
          {available.length > 0 && (
            <div className='border-t pt-4'>
              <p className='text-sm font-medium text-gray-700 mb-2'>Thêm nguyên liệu</p>
              <div className='flex gap-2'>
                <select
                  value={newIngredientId}
                  onChange={(e) => setNewIngredientId(Number(e.target.value))}
                  className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
                >
                  {available.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
                <input
                  type='number'
                  value={newQty || ''}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  placeholder='Số lượng'
                  min={0}
                  step={0.1}
                  className='w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
                />
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className='px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition disabled:opacity-50'
                >
                  {adding ? '...' : 'Thêm'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className='px-6 py-4 border-t text-right'>
          <button
            onClick={onClose}
            className='px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition'
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}