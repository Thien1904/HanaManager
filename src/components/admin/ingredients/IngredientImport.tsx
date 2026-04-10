'use client'
import { useState, useEffect } from 'react'
import { Ingredient } from '@/hooks/useIngredients'
import { Ingredient_Package } from '@/types/database'

interface Props {
  ingredients: Ingredient[] // Lấy từ useIngredients() ở trang cha
  onClose: () => void
  onChanged: () => void // Để load lại số tồn kho ở bảng chính
}

export default function IngredientImportForm({ ingredients, onClose, onChanged }: Props) {
  const [selectedIngId, setSelectedIngId] = useState<string>('')
  const [packages, setPackages] = useState<Ingredient_Package[]>([])
  const [selectedPkgId, setSelectedPkgId] = useState<string>('')
  
  const [quantity, setQuantity] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Đóng modal bằng phím Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch quy cách khi chọn nguyên liệu
  useEffect(() => {
    if (!selectedIngId) {
      setPackages([])
      return
    }
    async function fetchPackages() {
      const res = await window.fetch(`/api/ingredient-packages?ingredientId=${selectedIngId}`)
      const json = await res.json()
      if (res.ok) setPackages(json.data)
    }
    fetchPackages()
    setSelectedPkgId('') // Reset quy cách khi đổi nguyên liệu
  }, [selectedIngId])

  async function handleImport() {
    if (!selectedPkgId || quantity <= 0) {
      setError('Vui lòng chọn quy cách và nhập số lượng')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await window.fetch('/api/ingredient-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: Number(selectedPkgId),
          quantity_imported: quantity,
          unit_price: unitPrice,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lỗi nhập hàng')

      onChanged() // Load lại bảng kho ở trang cha
      onClose()   // Xong thì đóng modal
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold text-gray-800'>Nhập kho nguyên liệu</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>

        <div className='p-6 space-y-4'>
          {error && (
            <div className='bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg border border-red-100'>
              {error}
            </div>
          )}

          {/* Chọn Nguyên liệu */}
          <div className='space-y-1'>
            <label className='text-sm font-medium text-gray-700'>Nguyên liệu</label>
            <select
              value={selectedIngId}
              onChange={(e) => setSelectedIngId(e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none'
            >
              <option value="">-- Chọn nguyên liệu --</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
          </div>

          {/* Chọn Quy cách */}
          <div className='space-y-1'>
            <label className='text-sm font-medium text-gray-700'>Quy cách nhập</label>
            <select
              value={selectedPkgId}
              onChange={(e) => setSelectedPkgId(e.target.value)}
              disabled={!selectedIngId}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none disabled:bg-gray-50'
            >
              <option value="">-- Chọn quy cách --</option>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.package_name} (x{pkg.conversion_factor})
                </option>
              ))}
            </select>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-gray-700'>Số lượng nhập</label>
              <input
                type='number'
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min={1}
                className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none'
              />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-gray-700'>Đơn giá nhập</label>
              <input
                type='number'
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                placeholder='0'
                className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none'
              />
            </div>
          </div>
        </div>

        <div className='px-6 py-4 bg-gray-50 border-t flex gap-3 justify-end'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium'
          >
            Hủy
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !selectedPkgId}
            className='px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:bg-gray-300'
          >
            {loading ? 'Đang lưu...' : 'Xác nhận nhập'}
          </button>
        </div>
      </div>
    </div>
  )
}