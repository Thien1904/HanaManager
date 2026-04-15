// src/components/admin/ProductFormModal.tsx
// Modal thêm / sửa món ăn
// Bao gồm cấu hình in: printKitchen, print_bar, print_label

'use client'
import { Product } from '@/types/product'
import { useEffect, useRef, useState } from 'react'

type Category = { id: number; name: string }

interface Props {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

// Toggle component dùng lại
function Toggle({
  label,
  sub,
  checked,
  onChange,
  color = 'bg-orange-500',
}: {
  label: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
  color?: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? color : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
export default function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  const isEdit = !!product
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: product?.name ?? '',

    categoryId: product?.category?.id ?? categories[0]?.id ?? 0,

    price: product?.price ?? 0,
    description: product?.description ?? '',

    imageUrl: product?.imageUrl ?? '',

    isavailable: product?.isavailable ?? true,

    // cấu hình in
    printKitchen: product?.printKitchen ?? true,
    printBar: product?.printBar ?? false,
    printLabel: product?.printLabel ?? false,
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh tối đa 5MB')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)

    // Xóa ảnh cũ nếu có
    if (form.imageUrl) {
      await window.fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.imageUrl }),
      })
    }

    const res = await window.fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (data.data?.url) setForm((f) => ({ ...f, imageUrl: data.data.url }))
    else setError('Upload ảnh thất bại')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Tên món không được trống')
      return
    }
    if (!form.categoryId) {
      setError('Chọn danh mục')
      return
    }
    if (form.price <= 0) {
      setError('Giá phải lớn hơn 0')
      return
    }

    setSaving(true)
    const payload = isEdit ? { id: product!.id, ...form } : form
    const res = await window.fetch('/api/products', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) setError(data.error ?? 'Có lỗi xảy ra')
    else onSaved()
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Sửa món' : 'Thêm món mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Upload ảnh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh món</label>
            <div
              className="relative border-2 border-dashed border-gray-300 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:border-orange-400 transition overflow-hidden"
              onClick={() => fileRef.current?.click()}
            >
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-400 text-sm">
                  <div className="text-3xl mb-1">📷</div>
                  <div>Click để upload ảnh</div>
                  <div className="text-xs mt-1">JPG, PNG — tối đa 5MB</div>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm text-gray-500">
                  Đang upload...
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            {form.imageUrl && (
              <button
                type="button"
                onClick={async () => {
                  if (form.imageUrl) {
                    await window.fetch('/api/upload', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: form.imageUrl }),
                    })
                  }
                  setForm((f) => ({ ...f, imageUrl: '' }))
                }}
                className="mt-1 text-xs text-red-500 hover:underline"
              >
                Xóa ảnh
              </button>
            )}
          </div>

          {/* Tên món */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên món *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="VD: Phở bò đặc biệt"
            />
          </div>

          {/* Danh mục + Giá */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
              <select
                className={inputCls}
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: Number(e.target.value) }))}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá (đ) *</label>
              <input
                type="number"
                className={inputCls}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                min={0}
                step={1000}
              />
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả ngắn về món..."
            />
          </div>

          {/* Toggle trạng thái */}
          <Toggle
            label="Đang bán"
            sub="Bật = hiện trên menu, tắt = ẩn khỏi POS"
            checked={!!form.isavailable}
            onChange={(v) => setForm((f) => ({ ...f, isavailable: v }))}
            color="bg-green-500"
          />

          {/* ── Cấu hình in ── */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">🖨️ Cấu hình in</p>
            <div className="space-y-2">
              <Toggle
                label="Báo bếp (Kitchen)"
                sub="In phiếu chế biến gửi bếp khi order"
                checked={form.printKitchen}
                onChange={(v) => setForm((f) => ({ ...f, printKitchen: v }))}
                color="bg-orange-500"
              />
              <Toggle
                label="Báo bar"
                sub="In phiếu gửi bar khi order"
                checked={form.printBar}
                onChange={(v) => setForm((f) => ({ ...f, printBar: v }))}
                color="bg-blue-500"
              />
              <Toggle
                label="In tem dán ly"
                sub="In tem label dán lên ly/hộp"
                checked={form.printLabel}
                onChange={(v) => setForm((f) => ({ ...f, printLabel: v }))}
                color="bg-purple-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm món'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
