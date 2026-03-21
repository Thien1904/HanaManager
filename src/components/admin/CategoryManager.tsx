// src/components/admin/CategoryManager.tsx
'use client'
import { useEffect, useState } from 'react'
import { Category } from '@/hooks/useAdminProducts'

interface Props {
  categories: Category[]
  onClose: () => void
  onChanged: () => void
}

export default function CategoryManager({ categories: initial, onClose, onChanged }: Props) {
  const [cats, setCats]       = useState<Category[]>(initial)
  const [newName, setNewName] = useState('')
  const [editId, setEditId]   = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError]     = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function addCategory() {
    if (!newName.trim()) return
    setError('')
    const res = await window.fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    setCats((prev) => [...prev, json.data])
    setNewName('')
    onChanged()
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return
    setError('')
    const res = await window.fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    setCats((prev) => prev.map((c) => (c.id === id ? json.data : c)))
    setEditId(null)
    onChanged()
  }

  async function deleteCategory(id: number) {
    setError('')
    const res = await window.fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    setCats((prev) => prev.filter((c) => c.id !== id))
    onChanged()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md'>
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold'>Quản lý danh mục</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>

        <div className='px-6 py-4 space-y-3'>
          {error && (
            <div className='bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg'>{error}</div>
          )}

          {/* Thêm danh mục */}
          <div className='flex gap-2'>
            <input
              type='text'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder='Tên danh mục mới...'
              className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
            />
            <button
              onClick={addCategory}
              className='px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition'
            >
              Thêm
            </button>
          </div>

          {/* Danh sách */}
          <div className='space-y-2 max-h-72 overflow-y-auto'>
            {cats.map((cat) => (
              <div key={cat.id} className='flex items-center gap-2 p-2 bg-gray-50 rounded-lg'>
                {editId === cat.id ? (
                  <>
                    <input
                      autoFocus
                      type='text'
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(cat.id)
                        if (e.key === 'Escape') setEditId(null)
                      }}
                      className='flex-1 border border-orange-400 rounded px-2 py-1 text-sm focus:outline-none'
                    />
                    <button onClick={() => saveEdit(cat.id)} className='text-xs text-green-600 hover:underline'>Lưu</button>
                    <button onClick={() => setEditId(null)} className='text-xs text-gray-400 hover:underline'>Hủy</button>
                  </>
                ) : (
                  <>
                    <span className='flex-1 text-sm text-gray-800'>{cat.name}</span>
                    <button
                      onClick={() => { setEditId(cat.id); setEditName(cat.name); setError('') }}
                      className='text-xs text-blue-500 hover:underline'
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className='text-xs text-red-500 hover:underline'
                    >
                      Xóa
                    </button>
                  </>
                )}
              </div>
            ))}
            {cats.length === 0 && (
              <p className='text-center text-gray-400 text-sm py-4'>Chưa có danh mục</p>
            )}
          </div>
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