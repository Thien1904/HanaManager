// src/components/admin/MenuManager.tsx
'use client'
import { useState } from 'react'
import { useAdminProducts } from '@/hooks/useAdminProducts'
import type { Product } from '@/types/product'
import ProductFormModal from '@/components/admin/ProductFormModal'
import CategoryManager from '@/components/admin/CategoryManager'
import { Trash } from 'lucide-react'

export default function MenuManager() {
  const { products, categories, loading, error, refresh } = useAdminProducts()
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showCatManager, setShowCatManager] = useState(false)
  // load các món đã xóa
  const [deletedProducts, setDeletedProducts] = useState<Product[]>([])

  const filtered = products.filter((p) => {
    const pCatId = p.category?.id ?? (p as any).category_id ?? (p as any).categoryId

    const matchCategory =
      selectedCategory === 'all' || (pCatId && Number(pCatId) === Number(selectedCategory))

    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())

    return matchCategory && matchSearch
  })

  async function toggleAvailable(product: Product) {
    const currentStatus = product.isAvailable

    await window.fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: product.id, isAvailable: !currentStatus }),
    })

    refresh()
  }

  async function deleteProduct(id: number) {
    if (!confirm('Xóa món này? Món sẽ bị ẩn khỏi thực đơn.')) return
    await window.fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    refresh()
  }

  if (error) return <div className="p-6 text-center text-red-500">{error}</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý thực đơn</h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} món · {categories.length} danh mục
          </p>
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Danh mục</h2>
        </div>
        <div className="flex gap-2">
          {/*// button load các product đã Xóa*/}

          <button
            onClick={() => setShowCatManager(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Danh mục
          </button>
          <button
            onClick={() => {
              setEditProduct(null)
              setShowModal(true)
            }}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            + Thêm món
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Tìm tên món..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              selectedCategory === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                selectedCategory === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Không có món nào</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-xl border overflow-hidden transition ${
                product.isAvailable ? 'border-gray-200' : 'border-gray-200 opacity-50'
              }`}
            >
              {/* Ảnh */}
              <div className="relative aspect-square bg-gray-100">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-sm text-orange-500 font-semibold mt-0.5">
                  {product.price.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {product.category?.name ?? '—'}
                </p>
                <p
                  className="text-xs text-gray-400  mt-0.5"
                  style={{
                    WebkitLineClamp: 2,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    color: '#220ddf',
                    overflow: 'hidden',
                    fontStyle: 'bold',
                    fontSize: '15px',
                    textOverflow: 'ellipsis',
                    alignContent: 'center',
                  }}
                >
                  {product.description || 'Không có mô tả'}
                </p>

                {/* Actions */}
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => toggleAvailable(product)}
                    className={`flex-1 py-1 text-xs rounded-lg transition ${
                      product.isAvailable
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {product.isAvailable ? 'Có bán' : 'Hết'}
                  </button>
                  <button
                    onClick={() => {
                      setEditProduct(product)
                      setShowModal(true)
                    }}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="px-2 py-1 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            refresh()
          }}
        />
      )}
      {showCatManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCatManager(false)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}
