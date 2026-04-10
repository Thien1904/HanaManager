// src/components/admin/IngredientManager.tsx
// Trang quản lý nguyên liệu và công thức món ăn
// Phần 1: Bảng nguyên liệu — CRUD, filter tồn kho
// Phần 2: Bảng công thức — mỗi hàng = 1 món, cột động theo nguyên liệu của món đó
//   Workflow thêm mới: chọn món → xác nhận → thêm nguyên liệu (staged) → Lưu mới vào DB

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useIngredients, Ingredient } from '@/hooks/useIngredients'
import { useAdminProducts } from '@/hooks/useAdminProducts'
import IngredientFormModal from '@/components/admin/IngredientFormModal'
import { cls, filterTab } from '@/utils/styles'
import IngredientImportForm from '@/components/admin/ingredients/IngredientImport'
import { IngredientWithPackages as DB_IngredientWithPackages } from '@/types/database'
import { apiFetch } from '@/lib/api'

// Định nghĩa cho  Quy cách (Thùng, Két, Lon...)
interface IngredientPackage {
  id: number
  ingredient_id: number
  package_name: string
  conversion_factor: number
}
// Định nghĩa cho Nguyên liệu có kèm theo mảng các Quy cách
interface IngredientWithPackages {
  id: number
  name: string
  unit: string
  stock_quantity: number
  min_stock_level: number
  packages: IngredientPackage[]
}

interface RecipeRow {
  id: number
  quantity_needed: number
  ingredients: { id: number; name: string; unit: string }
}

interface DishRecipe {
  productId: number
  productName: string
  rows: RecipeRow[]
  dirty: Record<number, number>
}

interface StagedIngredient {
  ingredientId: number
  ingredientName: string
  unit: string
  quantity: number
}
interface supplier {
  id: number
  name: string
}

export default function IngredientManager() {
  //#region Constants

  useEffect(() => {
    fetch('/api/suppliers')
      .then(res => res.json())
      .then(data => {
        console.log('RAW:', data)

        if (Array.isArray(data)) {
          setSuppliers(data)
        } else if (Array.isArray(data.data)) {
          setSuppliers(data.data)
        } else {
          setSuppliers([]) // fallback
        }
      })
  }, [])
  const [unitPrice, setUnitPrice] = useState<number>(0)

  const [currentIng, setCurrentIng] = useState<IngredientWithPackages | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<IngredientPackage | null>(null)
  // State cho danh sách nhà cung cấp, để chọn khi tạo đơn nhập hàng
  const [suppliers, setSuppliers] = useState<supplier[]>([])
  //state quản lý tab đang active
  const [activeTab, setActiveTab] = useState<number>(1)
  //
  const { ingredients, loading, error, refresh } = useIngredients()
  const { products } = useAdminProducts()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Ingredient | null>(null)

  const [recipes, setRecipes] = useState<DishRecipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  const [selectedProductId, setSelectedProductId] = useState<number>(0)
  const [confirmed, setConfirmed] = useState(false)
  const [staged, setStaged] = useState<StagedIngredient[]>([])
  const [pickIngId, setPickIngId] = useState<number>(0)
  const [pickQty, setPickQty] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  // Thêm state sort
  const [sortKey, setSortKey] = useState<'name' | 'unit' | 'stock_quantity' | 'min_stock_level' | 'updated_at'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  // Toggle sort
  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  // Helper thêm mũi tên Sort
  const sortIcon = (key: typeof sortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕')

  //
  const [page, setPage] = useState(1)
  const [showAll, setShowAll] = useState(false)
  const PAGE_SIZE = 10
  const filteredIngredients = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || i.stock_quantity < 0 || i.stock_quantity <= i.min_stock_level
    return matchSearch && matchFilter
  })
  // Thêm vào phần state bảng công thức
  const [recipeSearch, setRecipeSearch] = useState('')
  // 1 Thêm filter cho bảng nguyên liệu
  const filterRecipes = recipes.filter(
    r =>
      r.productName.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      r.rows.some(row => row.ingredients.name.toLowerCase().includes(recipeSearch.toLowerCase())),
  )
  //End1

  // 2 Áp dụng sort vào filteredIngredients trước khi page
  const sortedIngredients = [...filteredIngredients].sort((a, b) => {
    const v1 = a[sortKey],
      v2 = b[sortKey]
    const cmp = typeof v1 === 'string' ? v1.localeCompare(v2 as string) : (v1 as number) - (v2 as number)
    return sortDir === 'asc' ? cmp : -cmp
  })
  //end 2
  // 3 Tính toán số page
  const totalPages = Math.ceil(sortedIngredients.length / PAGE_SIZE)
  const pagedIngredients = showAll
    ? sortedIngredients
    : sortedIngredients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  //end 3
  const lowStockCount = ingredients.filter(i => i.stock_quantity <= i.min_stock_level).length
  // Hàm loadAllRecipes — gọi API lấy công thức cho tất cả món, lưu vào state recipes
  const loadAllRecipes = useCallback(async () => {
    if (!products.length) return
    setLoadingRecipes(true)
    try {
      const results = await Promise.all(
        products.map(async (p: any) => {
          const res = await window.fetch(`/api/recipes?product_id=${p.id}`)
          const json = await res.json()
          return { productId: p.id, productName: p.name, rows: res.ok ? json.data : [], dirty: {} }
        }),
      )
      setRecipes(results.filter(r => r.rows.length > 0))
    } finally {
      setLoadingRecipes(false)
    }
  }, [products])

  // State cho modal nhập hàng quy đổi
  const [showImportModal, setShowImportModal] = useState(false)
  //state cho đơn nhập hàng tổng, lưu nguyên liệu đang chọn, số lượng, giá tiền để gửi lên API tạo đơn nhập hàng
  const [selectedIngId, setSelectedIngId] = useState<number | string>('')
  // Danh sách các món đang chờ nhập, mỗi món gồm: id nguyên liệu, tên nguyên liệu, đơn vị, số lượng, giá tiền
  const [cart, setCart] = useState<any[]>([]) // Danh sách các món đang chờ nhập
  // State cho quy cách đóng gói của nguyên liệu, khi chọn nguyên liệu sẽ fetch các quy cách tương ứng để chọn tiếp
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null)

  // State cho đơn nhập hàng tổng
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')

  const [quantity, setQuantity] = useState<number>(1)
  const [price, setPrice] = useState<number>(0)

  useEffect(() => {
    loadAllRecipes()
  }, [loadAllRecipes])
  //#endregion

  /**
   * The function `resetAddFlow` resets various state variables used in an add flow process in a
   * TypeScript React application.
   */
  function resetAddFlow() {
    setSelectedProductId(0)
    setConfirmed(false)
    setStaged([])
    setPickIngId(0)
    setPickQty('')
    setAddError('')
  }

  async function handleDeleteIngredient(id: number, name: string) {
    if (!confirm(`Xóa nguyên liệu "${name}"?`)) return
    const res = await window.fetch('/api/ingredients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error)
    else refresh()
  }

  function handleAddStaged() {
    setAddError('')
    if (!pickIngId) {
      setAddError('Chọn nguyên liệu')
      return
    }
    const qty = parseFloat(pickQty)
    if (!pickQty || isNaN(qty) || qty <= 0) {
      setAddError('Định lượng phải lớn hơn 0')
      return
    }
    if (staged.find(s => s.ingredientId === pickIngId)) {
      setAddError('Nguyên liệu này đã được thêm')
      return
    }
    const ing = ingredients.find(i => i.id === Number(pickIngId)) as DB_IngredientWithPackages | undefined
    setStaged(prev => [...prev, { ingredientId: ing?.id, ingredientName: ing?.name, unit: ing?.unit, quantity: qty }])
    setPickIngId(0)
    setPickQty('')
  }

  async function handleConfirmRecipe() {
    if (!staged.length) {
      setAddError('Thêm ít nhất 1 nguyên liệu')
      return
    }
    setSaving(true)
    setAddError('')
    try {
      await Promise.all(
        staged.map(s =>
          window.fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: selectedProductId,
              ingredient_id: s.ingredientId,
              quantity_needed: s.quantity,
            }),
          }),
        ),
      )
      resetAddFlow()
      await loadAllRecipes()
    } catch {
      setAddError('Lưu thất bại, thử lại')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAllDirty(dish: DishRecipe) {
    await Promise.all(
      Object.entries(dish.dirty).map(([recipeId, qty]) =>
        window.fetch('/api/recipes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(recipeId), quantity_needed: qty }),
        }),
      ),
    )
    await loadAllRecipes()
  }

  async function handleDeleteRecipeRow(productId: number, recipeId: number, name: string) {
    if (!confirm(`Xóa "${name}" khỏi công thức?`)) return
    await window.fetch('/api/recipes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recipeId }),
    })
    await loadAllRecipes()
  }

  async function handleDeleteDish(dish: DishRecipe) {
    if (!confirm(`Xóa toàn bộ công thức của "${dish.productName}"?`)) return
    await Promise.all(
      dish.rows.map(r =>
        window.fetch('/api/recipes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id }),
        }),
      ),
    )
    await loadAllRecipes()
  }

  const dishesWithoutRecipe = products.filter((p: any) => !recipes.find(r => r.productId === p.id))
  const availableIngredients = ingredients.filter(i => !staged.find(s => s.ingredientId === i.id))
  const selectedProduct = products.find((p: any) => p.id === selectedProductId)

  if (error) return <div className="p-6 text-center text-red-500">{error}</div>
  // Hàm addToCart: Kiểm tra đã chọn nguyên liệu, quy cách và số lượng hợp lệ chưa, nếu hợp lệ thì thêm vào cart (danh sách chờ nhập)
  const addToCart = () => {
    if (!currentIng || !selectedPkg) {
      alert('chọn món với quy cách ?!')
      return
    }
    if (quantity <= 0) return alert('Số lượng phải lớn hơn 0.')

    const newItem = {
      tempId: Date.now(), // Tạo ID tạm để xóa/sửa cho dễ
      ingredient_id: currentIng.id,
      ingredient_name: currentIng.name,
      package_id: selectedPkg.id,
      package_name: selectedPkg.package_name,
      conversion_factor: selectedPkg.conversion_factor,
      quantity: quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice,
    }

    setCart([...cart, newItem])

    // Thêm xong thì reset mấy ô nhập cho nhân viên rảnh tay
    setQuantity(1)
    setUnitPrice(0)
  }
  // --- Khu vực Logic của Tab 3 ---

  // 1. Hàm tạo quy cách mới
  const handleCreatePkg = async (name: string, factor: string) => {
    if (!name || !factor) {
      alert('Điền đủ thông tin quy cách đã!')
      return
    }

    try {
      const res = await fetch('/api/ingredient-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: selectedIngId,
          package_name: name,
          conversion_factor: Number(factor),
        }),
      })

      if (res.ok) {
        alert('Thêm quy cách thành công!')
        // Reset input sau khi thêm
        ;(document.getElementById('new_pkg_name') as HTMLInputElement).value = ''
        ;(document.getElementById('new_conversion') as HTMLInputElement).value = ''
        if (typeof refresh === 'function') refresh()
      } else {
        const err = await res.json()
        alert('Lỗi: ' + err.message)
      }
    } catch (error) {
      alert('Không kết nối được API cấu hình!')
    }
  }

  // 2. Hàm xóa quy cách
  const handleDeletePkg = async (id: number) => {
    if (!confirm('Chắc chắn xóa quy cách này?')) return

    try {
      const res = await fetch('/api/ingredient-packages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        alert('Đã xóa xong!')
        if (typeof refresh === 'function') refresh()
      } else {
        alert('Lỗi: Quy cách này có thể đang được dùng trong đơn nhập hàng, không xóa được!')
      }
    } catch (error) {
      alert('Lỗi hệ thống khi xóa!')
    }
  }

  return (
    <div className="p-max max-w-7xl mx-auto space-y-10 ">
      {/*Menu tab chuyển giữa quản lý nguyên liệu và công thức*/}
      <div className="flex gap-4 border-b my-4">
        <button
          onClick={() => setActiveTab(1)}
          className={activeTab === 1 ? 'text-blue-600 border-b-2 border-blue-600' : ''}>
          Nguyên liệu & Công thức món
        </button>
        <button
          onClick={() => setActiveTab(2)}
          className={activeTab === 2 ? 'text-blue-600 border-b-2 border-blue-600' : ''}>
          Nhập hàng
        </button>
        <button
          onClick={() => setActiveTab(3)}
          className={activeTab === 3 ? 'text-blue-600 border-b-2 border-blue-600' : ''}>
          Quản lý đơn nhập hàng
        </button>
      </div>
      {/* --- NỘI DUNG --- */}
      {activeTab === 1 && (
        <div>
          {/* PHẦN 1: NGUYÊN LIỆU */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-gray-800">Danh sách nguyên liệu</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {ingredients.length} nguyên liệu
                  {lowStockCount > 0 && (
                    <span className="ml-2 text-red-500 font-medium">· {lowStockCount} sắp hết</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition">
                + Nhập hàng quy đổi
              </button>
              <button
                onClick={() => {
                  setEditItem(null)
                  setShowModal(true)
                }}
                className={cls.btnPrimary}>
                + Thêm nguyên liệu
              </button>
            </div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <input
                type="text"
                placeholder="Tìm tên nguyên liệu..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className={`${cls.searchInput} w-60`}
              />
              <button onClick={() => setFilter('all')} className={filterTab(filter === 'all')}>
                Tất cả
              </button>
              <button onClick={() => setFilter('low')} className={filterTab(filter === 'low')}>
                Sắp hết {lowStockCount > 0 && `(${lowStockCount})`}
              </button>
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-400">Đang tải...</div>
            ) : filteredIngredients.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Không có nguyên liệu nào</div>
            ) : (
              <div className={cls.tableWrap}>
                <table className={cls.table}>
                  <thead className={cls.thead}>
                    <tr>
                      <th
                        className={`${cls.th} cursor-pointer select-none hover:bg-gray-100`}
                        onClick={() => toggleSort('name')}>
                        Tên nguyên liệu{sortIcon('name')}
                      </th>
                      <th className={cls.th}>Đơn vị</th>
                      <th
                        className={`${cls.th} cursor-pointer select-none hover:bg-gray-100`}
                        onClick={() => toggleSort('stock_quantity')}>
                        Tồn kho{sortIcon('stock_quantity')}
                      </th>
                      <th
                        className={`${cls.th}cursor-pointer selec -none hover:bg-gray-100`}
                        onClick={() => toggleSort('min_stock_level')}>
                        Mức tối thiểu{sortIcon('min_stock_level')}
                      </th>
                      <th
                        className={`${cls.th} cursor-pointer select-none hover:bg-gray-100`}
                        onClick={() => toggleSort('min_stock_level')}>
                        Trạng thái{sortIcon('min_stock_level')}
                      </th>
                      <th
                        className={`${cls.th} cursor-pointer select-none hover:bg-gray-100`}
                        onClick={() => toggleSort('updated_at')}>
                        Ngày cập nhật{sortIcon('updated_at')}
                      </th>
                      <th className={cls.th}>Tác vụ</th>
                      <th className={cls.th}>Đặt lại số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedIngredients.map(item => {
                      const isEmpty = item.stock_quantity === 0
                      const isLow = item.stock_quantity <= item.min_stock_level
                      return (
                        <tr key={item.id} className={cls.tr}>
                          <td className={`${cls.td} font-medium text-gray-900`}>{item.name}</td>
                          <td className={`${cls.td} text-gray-600`}>{item.unit}</td>
                          <td className={cls.td}>
                            <span
                              className={`font-medium ${isEmpty ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-gray-900'}`}>
                              {item.stock_quantity}
                            </span>
                          </td>
                          <td className={`${cls.td} text-gray-500`}>{item.min_stock_level}</td>
                          <td className={cls.td}>
                            {item.stock_quantity === 0 ? (
                              <span className={cls.badgeOrange}>Hết hàng</span>
                            ) : item.stock_quantity > 0 && item.stock_quantity <= item.min_stock_level ? (
                              <span className={cls.badgeOrange}>Sắp hết</span>
                            ) : item.stock_quantity < 0 ? (
                              <span className={cls.badgeRed}>Cháy hàng</span>
                            ) : (
                              <span className={cls.badgeGreen}>Đủ hàng</span>
                            )}
                          </td>
                          <td className={`${cls.td} text-xs text-gray-400`}>
                            {new Date(item.updated_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className={cls.td}>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditItem(item)
                                  setShowModal(true)
                                }}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                                Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(item.id, item.name)}
                                className="px-2 py-1 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition">
                                Xóa
                              </button>
                            </div>
                          </td>
                          <td className={cls.td}>
                            <div className="flex justify-center">
                              {item.stock_quantity < 0 && (
                                <button
                                  onClick={async () => {
                                    const isAccepted = window.confirm(
                                      `Bạn có muốn reset số lượng của "${item.name}" về 0 không?`,
                                    )
                                    if (!isAccepted) return
                                    try {
                                      const res = await window.fetch('/api/ingredients', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: item.id, stock_quantity: 0 }),
                                      })
                                      if (res.ok) refresh()
                                      else alert('Lỗi rồi, không reset được!')
                                    } catch (err) {
                                      console.error(err)
                                    }
                                  }}
                                  className="text-sm bg-yellow-50 text-red-800 rounded-lg hover:bg-yellow-100 px-2 py-1">
                                  Đặt lại về 0
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!showAll && totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {filteredIngredients.length} nguyên liệu · trang {page}/{totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
                        ‹
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2 py-1 text-xs border rounded ${
                            p === page
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}>
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
                        ›
                      </button>
                    </div>
                    <button onClick={() => setShowAll(true)} className="text-xs text-orange-500 hover:underline">
                      Xem tất cả
                    </button>
                  </div>
                )}
                {showAll && (
                  <div className="flex justify-end px-4 py-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowAll(false)
                        setPage(1)
                      }}
                      className="text-xs text-orange-500 hover:underline">
                      Thu gọn
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PHẦN 2: CÔNG THỨC MÓN ĂN */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Công thức món ăn</h2>
              <p className="text-sm text-gray-500 mt-1">{recipes.length} món đã có công thức</p>
            </div>

            {/* Panel thêm công thức mới — layout 2 cột 40/60 */}
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex gap-4 items-start">
                {/* Cột trái 40%: Chọn món + Xác nhận/Hủy */}
                <div className="w-[40%] space-y-2">
                  <p className="text-xs font-medium text-gray-600">Thêm công thức cho món:</p>
                  <select
                    value={selectedProductId}
                    onChange={e => {
                      setSelectedProductId(Number(e.target.value))
                      setConfirmed(false)
                      setStaged([])
                      setPickIngId(0)
                      setPickQty('')
                      setAddError('')
                    }}
                    disabled={confirmed}
                    className={`${cls.select} w-full`}>
                    <option value={0}>-- Chọn món --</option>
                    {dishesWithoutRecipe.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {selectedProductId > 0 && !confirmed && (
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmed(true)} className={cls.btnPrimary}>
                        Xác nhận →
                      </button>
                      <button onClick={resetAddFlow} className={cls.btnSecondary}>
                        Hủy
                      </button>
                    </div>
                  )}
                  {confirmed && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-orange-600">{selectedProduct?.name}</span>
                      <button onClick={resetAddFlow} className="text-xs text-gray-400 hover:text-gray-600">
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Cột phải 60%: Chọn nguyên liệu + số lượng + Add + staged */}
                <div className="w-[60%] space-y-3">
                  {confirmed ? (
                    <>
                      <p className="text-xs font-medium text-gray-600">Thêm nguyên liệu:</p>
                      <div className="flex items-center gap-2">
                        {/* Dropdown nguyên liệu */}
                        <select
                          value={pickIngId}
                          onChange={e => {
                            setPickIngId(Number(e.target.value))
                            setPickQty('')
                            setAddError('')
                          }}
                          className={`${cls.select} flex-1`}>
                          <option value={0}>-- Chọn nguyên liệu --</option>
                          {availableIngredients.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>

                        {/* Textbox số lượng — chỉ hiện khi đã chọn nguyên liệu */}
                        {pickIngId > 0 && (
                          <input
                            type="number"
                            value={pickQty}
                            onChange={e => {
                              setPickQty(e.target.value)
                              setAddError('')
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleAddStaged()}
                            placeholder="VD: 0.08"
                            min={0.001}
                            step={0.001}
                            autoFocus
                            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        )}

                        {/* Nút Add — chỉ hiện khi số lượng hợp lệ */}
                        {pickIngId > 0 && parseFloat(pickQty) > 0 && (
                          <button onClick={handleAddStaged} className={cls.btnPrimary}>
                            Add
                          </button>
                        )}
                      </div>

                      {addError && <p className="text-xs text-red-500">{addError}</p>}

                      {/* Preview staged — hàng ngang, giữ nguyên cấu trúc sau khi add */}
                      {staged.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-600">Đã thêm ({staged.length}):</p>
                          <div className="flex gap-2 flex-wrap">
                            {staged.map(s => (
                              <div
                                key={s.ingredientId}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-sm shadow-sm">
                                <span className="font-medium text-gray-800">{s.ingredientName}</span>
                                <span className="text-gray-400 text-xs">({s.unit})</span>
                                <span className="font-semibold text-orange-600">{s.quantity}</span>
                                <button
                                  onClick={() => setStaged(prev => prev.filter(x => x.ingredientId !== s.ingredientId))}
                                  className="text-red-300 hover:text-red-500 text-base leading-none">
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleConfirmRecipe}
                              disabled={saving}
                              className={`${cls.btnPrimary} disabled:opacity-50`}>
                              {saving ? 'Đang lưu...' : `Lưu công thức (${staged.length} nguyên liệu)`}
                            </button>
                            <button onClick={resetAddFlow} className={cls.btnSecondary}>
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic pt-6">← Chọn món và xác nhận để thêm nguyên liệu</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bảng công thức đã lưu */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Tìm món hoặc nguyên liệu trong công thức..."
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                className={`${cls.searchInput} w-60`}
              />
            </div>
            {loadingRecipes ? (
              <div className="text-center py-10 text-gray-400">Đang tải công thức...</div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Chưa có công thức nào.</div>
            ) : (
              <div className="space-y-3">
                {filterRecipes.map(dish => {
                  const hasDirty = Object.keys(dish.dirty).length > 0
                  return (
                    <div key={dish.productId} className={`${cls.tableWrap} overflow-x-auto`}>
                      <table className={cls.table} style={{ minWidth: 'max-content' }}>
                        <thead className={cls.thead}>
                          <tr>
                            <th className={`${cls.th} bg-orange-50 min-w-[160px] align-top`}>
                              <div className="font-semibold text-gray-900 mb-2">{dish.productName}</div>
                              <div className="flex gap-1 flex-wrap">
                                {hasDirty && (
                                  <button
                                    onClick={() => handleSaveAllDirty(dish)}
                                    className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition">
                                    Save
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteDish(dish)}
                                  className="px-2 py-0.5 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100 transition">
                                  Delete
                                </button>
                              </div>
                            </th>
                            {dish.rows.map(row => (
                              <th key={row.id} className={`${cls.th} text-center min-w-[130px]`}>
                                <div className="text-gray-800 font-medium">{row.ingredients.name}</div>
                                <div className="text-xs text-gray-400 font-normal">({row.ingredients.unit})</div>
                                <button
                                  onClick={() => handleDeleteRecipeRow(dish.productId, row.id, row.ingredients.name)}
                                  className="text-xs text-red-300 hover:text-red-500 mt-0.5">
                                  ✕
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className={`${cls.td} bg-orange-50`}></td>
                            {dish.rows.map(row => {
                              const currentQty = dish.dirty[row.id] ?? row.quantity_needed
                              const isDirty = row.id in dish.dirty
                              return (
                                <td key={row.id} className={`${cls.td} text-center`}>
                                  <input
                                    type="number"
                                    value={currentQty}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value)
                                      if (isNaN(val)) return
                                      setRecipes(prev =>
                                        prev.map(r =>
                                          r.productId === dish.productId
                                            ? { ...r, dirty: { ...r.dirty, [row.id]: val } }
                                            : r,
                                        ),
                                      )
                                    }}
                                    min={0.001}
                                    step={0.001}
                                    className={`w-24 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                      isDirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                                    }`}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/*Tab 2 nhập hàng quy đổi */}

      {activeTab === 2 && (
        <div>
          <h1 className="text-2xl font-bold mb-4">Nhập hàng</h1>
          <div className="space-y-6">
            {/* KHỐI 1: THÔNG TIN CHUNG */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🏪 NHÀ CUNG CẤP</label>
                  <select
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}>
                    {Array.isArray(suppliers) &&
                      suppliers.map(s => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">📅 NGÀY NHẬP</label>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleDateString('vi-VN')}
                    className="w-full p-3 bg-gray-50 border rounded-lg text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* KHỐI 2: CHỌN MÓN VÀ QUY CÁCH */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-blue-800 mb-2">🔍 TÌM NGUYÊN LIỆU</label>
                  <select
                    className="w-full p-3 border-2 border-blue-200 rounded-lg focus:border-blue-500"
                    value={selectedIngId}
                    onChange={e => {
                      const val = e.target.value
                      setSelectedIngId(val) // Lưu ID (dạng string/number tùy state

                      if (!val) {
                        setCurrentIng(null)
                        return
                      }

                      // Tìm nguyên liệu và ép kiểu an toàn
                      const ing = ingredients.find(i => i.id === Number(val)) as any
                      setCurrentIng((ing || null) as unknown as IngredientWithPackages | null)

                      // QUAN TRỌNG: Reset quy cách khi đổi món
                      setSelectedPkgId(null)
                      setSelectedPkg(null)
                    }}>
                    <option value="">-- Chọn nguyên liệu --</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">📦 QUY CÁCH</label>
                  <select
                    className="w-full p-3 border-2 border-blue-200 rounded-lg"
                    value={selectedPkgId}
                    onChange={e => {
                      const pkgId = Number(e.target.value)
                      setSelectedPkgId(pkgId)

                      const pkg = currentIng?.packages?.find(p => p.id === pkgId)
                      setSelectedPkg(pkg || null)
                    }}
                    disabled={!currentIng}>
                    <option value="">-- Chọn quy cách --</option>
                    {currentIng?.packages?.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.package_name} (x{p.conversion_factor} {currentIng.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">🔢 SỐ LƯỢNG</label>
                  <input
                    type="number"
                    className="w-full p-3 border-2 border-blue-200 rounded-lg"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">💰 GIÁ</label>
                  <input
                    type="number"
                    className="w-full p-3 border-2 border-blue-200 rounded-lg"
                    value={unitPrice}
                    onChange={e => setUnitPrice(Number(e.target.value))}
                  />
                </div>
                <button
                  onClick={() => {
                    if (!currentIng || !selectedPkg || quantity <= 0) {
                      alert('Vui lòng chọn nguyên liệu, quy cách và số lượng hợp lệ!')
                      return
                    }
                    const newItem = {
                      tempId: Date.now(),
                      ingredient_id: currentIng.id,
                      ingredient_name: currentIng.name,
                      package_id: selectedPkg.id,
                      package_name: selectedPkg.package_name,
                      conversion_factor: selectedPkg.conversion_factor, // snapshot
                      quantity: quantity,
                      unit_price: unitPrice,
                      total: quantity * unitPrice,
                    }
                    setCart(prev => [...prev, newItem])

                    // reset UI
                    setQuantity(1)
                    setUnitPrice(0)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                  ➕ THÊM VÀO GIỎ
                </button>
                {/* Hiển thị cart (danh sách chờ nhập*/}
                {cart.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border mt-4">
                    <h3 className="font-bold mb-2">🛒 Danh sách nhập</h3>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th>Tên</th>
                          <th>Quy cách</th>
                          <th>SL</th>
                          <th>Giá</th>
                          <th>Tổng</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.tempId} className="border-b">
                            <td>{item.ingredient_name}</td>
                            <td>{item.package_name}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unit_price}</td>
                            <td>{item.total}</td>
                            <td>
                              <button
                                onClick={() => setCart(cart.filter(i => i.tempId !== item.tempId))}
                                className="text-red-500">
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Lưu đơn nhập hàng: tạo order trước rồi mới insert từng món vào, nếu có lỗi sẽ catch để tránh tạo đơn dở dang */}
                {cart.length > 0 && (
                  <button
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg w-full font-bold"
                    onClick={async () => {
                      // 1. Kiểm tra nhanh
                      if (!selectedSupplierId || cart.length === 0) {
                        alert('Vui lòng chọn nhà cung cấp và thêm món vào giỏ!')
                        return
                      }

                      try {
                        // 2. Gửi dữ liệu đi (Gọi duy nhất 1 API này thôi)
                        const res = await fetch('/api/ingredient-imports', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            supplier_id: Number(selectedSupplierId),
                            items: cart.map(item => ({
                              package_id: item.package_id,
                              ingredient_id: item.ingredient_id,
                              quantity_imported: item.quantity,
                              unit_price: item.unit_price,
                              conversion_factor: item.conversion_factor,
                            })),
                          }),
                        })

                        // 3. Xử lý kết quả
                        if (res.ok) {
                          alert('✅ Xong! Đã tạo đơn và vào kho thành công.')
                          setCart([]) // Xóa giỏ hàng sau khi lưu
                          if (typeof refresh === 'function') refresh() // Load lại số liệu nếu có hàm refresh
                        } else {
                          const errorData = await res.json()
                          alert('❌ Lỗi: ' + (errorData.message || 'Không thể lưu đơn'))
                        }
                      } catch (err: any) {
                        console.error('Lỗi khi fetch:', err)
                        alert('Lỗi kết nối hệ thống!')
                      }
                    }}>
                    💾 Xác nhận Lưu đơn & Nhập kho
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/*Tab 3 quản lý đơn nhập hàng tổng */}
      {activeTab === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Bên trái: Chọn Nguyên liệu */}
          <div className="card bg-base-100 shadow p-4 border">
            <h3 className="font-bold mb-4">1. Chọn nguyên liệu</h3>
            <select
              className="select select-bordered w-full"
              value={selectedIngId || ''}
              onChange={e => {
                const id = e.target.value
                setSelectedIngId(id)
                const ing = ingredients.find(i => i.id === Number(id))
                setCurrentIng((ing || null) as any)
              }}>
              <option value="">-- Chọn món cần cấu hình --</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Bên phải: Danh sách & Thêm mới */}
          <div className="md:col-span-2 card bg-base-100 shadow p-4 border">
            <h3 className="font-bold mb-4">2. Quy cách đóng gói của: {currentIng?.name || '...'}</h3>

            {!currentIng ? (
              <div className="text-center py-10 text-gray-400">Vui lòng chọn nguyên liệu bên trái trước</div>
            ) : (
              <>
                {/* Table danh sách quy cách */}
                <table className="table w-full mb-6">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Tên quy cách</th>
                      <th>Hệ số quy đổi</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentIng.packages?.map((pkg: any) => (
                      <tr key={pkg.id}>
                        <td>{pkg.package_name}</td>
                        <td>x{pkg.conversion_factor}</td>
                        <td>{pkg.is_active ? '✅ Đang dùng' : '❌ Tạm ngưng'}</td>
                        <td>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeletePkg(pkg.id)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Form thêm quy cách mới */}
                <div className="p-4 border-t bg-base-50 rounded">
                  <h4 className="font-semibold mb-2 text-sm text-blue-600">➕ Thêm quy cách mới</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Tên (VD: Thùng 24)"
                      className="input input-bordered input-sm flex-1"
                      id="new_pkg_name"
                    />
                    <input
                      type="number"
                      placeholder="Hệ số (VD: 24)"
                      className="input input-bordered input-sm w-32"
                      id="new_conversion"
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const name = (document.getElementById('new_pkg_name') as HTMLInputElement).value
                        const factor = (document.getElementById('new_conversion') as HTMLInputElement).value
                        handleCreatePkg(name, factor)
                      }}>
                      Lưu
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showImportModal && (
        <IngredientImportForm ingredients={ingredients} onClose={() => setShowImportModal(false)} onChanged={refresh} />
      )}
      {showModal && (
        <IngredientFormModal
          ingredient={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
