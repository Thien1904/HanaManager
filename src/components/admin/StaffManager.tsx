'use client'

import { useState, useMemo } from 'react'
import { useStaff, StaffMember } from '@/hooks/useStaff'
import StaffFormModal from '@/components/admin/StaffFormModal'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin:  { label: 'Admin',    color: 'bg-purple-100 text-purple-700' },
  waiter: { label: 'Phục vụ', color: 'bg-blue-100 text-blue-700' },
  chef:   { label: 'Bếp',     color: 'bg-orange-100 text-orange-700' },
}

// 🔹 Component header sort (tái sử dụng)
const SortHeader = ({
  label,
  column,
  sortField,
  sortOrder,
  onSort
}: {
  label: string
  column: string
  sortField: string
  sortOrder: 'asc' | 'desc'
  onSort: (col: string) => void
}) => {
  const isActive = sortField === column

  return (
    <th
      onClick={() => onSort(column)}
      className='px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100'
    >
      <div className='flex items-center gap-1'>
        {label}
        {!isActive && <ArrowUpDown size={14} className='opacity-40' />}
        {isActive && sortOrder === 'asc' && <ArrowUp size={14} />}
        {isActive && sortOrder === 'desc' && <ArrowDown size={14} />}
      </div>
    </th>
  )
}

export default function StaffManager() {
  const { staff, employeeTypes, loading, error, refresh } = useStaff()

  const [search, setSearch]         = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [showModal, setShowModal]   = useState(false)
  const [editStaff, setEditStaff]   = useState<StaffMember | null>(null)

  // 🔥 SORT STATE
  const [sortField, setSortField] = useState<string>('username')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 🔥 HANDLE SORT CLICK
  const handleSort = (column: string) => {
    if (sortField === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(column)
      setSortOrder('asc')
    }
  }

  // 🔥 FILTER
  const filtered = staff.filter((s) => {
    const matchRole   = filterRole === 'all' || s.role === filterRole
    const matchSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase())

    return matchRole && matchSearch
  })

  // 🔥 SORT (dựa trên filtered)
  const sortedStaff = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let result = 0

      if (sortField === 'full_name') {
        result = a.full_name.localeCompare(b.full_name)
      }

      if (sortField === 'username') {
        result = a.username.localeCompare(b.username)
      }

      if (sortField === 'role') {
        result = a.role.localeCompare(b.role)
      }

      if (sortField === 'hire_date') {
        const aDate = a.employee_profiles?.hire_date
          ? new Date(a.employee_profiles.hire_date).getTime()
          : 0

        const bDate = b.employee_profiles?.hire_date
          ? new Date(b.employee_profiles.hire_date).getTime()
          : 0

        result = aDate - bDate
      }

      if (sortField === 'is_active') {
        result = a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1
      }

      return sortOrder === 'asc' ? result : -result
    })
  }, [filtered, sortField, sortOrder])

  async function toggleActive(s: StaffMember) {
    await window.fetch('/api/staff', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: s.id, is_active: !s.is_active }),
    })
    refresh()
  }

  if (error) return <div className='p-6 text-center text-red-500'>{error}</div>

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-semibold text-gray-900'>Quản lý nhân viên</h1>
          <p className='text-sm text-gray-500 mt-1'>
            {staff.length} nhân viên · {staff.filter(s => s.is_active).length} đang hoạt động
          </p>
        </div>

        <button
          onClick={() => { setEditStaff(null); setShowModal(true) }}
          className='px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition'
        >
          + Thêm nhân viên
        </button>
      </div>

      {/* Filter */}
      <div className='flex gap-3 mb-5 flex-wrap'>
        <input
          type='text'
          placeholder='Tìm tên hoặc username...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='border border-gray-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-orange-400'
        />

        <div className='flex gap-2'>
          {['all', 'admin', 'waiter', 'chef'].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                filterRole === r
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r === 'all' ? 'Tất cả' : ROLE_LABEL[r].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className='text-center py-20 text-gray-400'>Đang tải...</div>
      ) : sortedStaff.length === 0 ? (
        <div className='text-center py-20 text-gray-400'>Không có nhân viên nào</div>
      ) : (
        <div className='bg-white rounded-xl border border-gray-200 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                <SortHeader label="Nhân viên" column="full_name" {...{ sortField, sortOrder, onSort: handleSort }} />
                <SortHeader label="Username" column="username" {...{ sortField, sortOrder, onSort: handleSort }} />
                <SortHeader label="Vai trò" column="role" {...{ sortField, sortOrder, onSort: handleSort }} />
                <SortHeader label="Ngày vào" column="hire_date" {...{ sortField, sortOrder, onSort: handleSort }} />
                <SortHeader label="Trạng thái" column="is_active" {...{ sortField, sortOrder, onSort: handleSort }} />
                <th></th>
              </tr>
            </thead>

            <tbody className='divide-y divide-gray-100'>
              {sortedStaff.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <div className='w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs'>
                        {s.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className='font-medium'>{s.full_name}</p>
                        <p className='text-xs text-gray-400'>{s.phone ?? '—'}</p>
                      </div>
                    </div>
                  </td>

                  <td className='px-4 py-3 text-xs font-mono'>{s.username}</td>

                  <td className='px-4 py-3'>
                    <span className={`px-2 py-1 rounded-md text-xs ${ROLE_LABEL[s.role]?.color}`}>
                      {ROLE_LABEL[s.role]?.label}
                    </span>
                  </td>

                  <td className='px-4 py-3 text-xs'>
                    {s.employee_profiles?.hire_date
                      ? new Date(s.employee_profiles.hire_date).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>

                  <td className='px-4 py-3'>
                    <button
                      onClick={() => toggleActive(s)}
                      className={`px-2 py-1 text-xs rounded-md ${
                        s.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {s.is_active ? 'Hoạt động' : 'Vô hiệu'}
                    </button>
                  </td>

                  <td className='px-4 py-3'>
                    <button
                      onClick={() => { setEditStaff(s); setShowModal(true) }}
                      className='px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg'
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <StaffFormModal
          staff={editStaff}
          employeeTypes={employeeTypes}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refresh() }}
        />
      )}
    </div>
  )
}