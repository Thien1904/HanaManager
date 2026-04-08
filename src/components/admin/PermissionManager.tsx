// src/components/admin/PermissionManager.tsx
// Trang phân quyền user — chọn user → tick/bỏ tick từng quyền
// Admin luôn có full quyền, không hiện trong danh sách

'use client'
import { useState, useEffect, useCallback } from 'react'
import { cls } from '@/utils/styles'

interface Permission {
  id: number
  code: string
  name: string
  group_name: string
}

interface StaffUser {
  id: number
  username: string
  full_name: string
  role: string
  is_active: boolean
}

// Màu badge theo role
const ROLE_BADGE: Record<string, string> = {
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-orange-100 text-orange-700',
  admin: 'bg-purple-100 text-purple-700',
}

export default function PermissionManager() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null)
  const [allPerms, setAllPerms] = useState<Permission[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  /**
   * loadUsers — lấy danh sách nhân viên (trừ admin)
   */
  const loadUsers = useCallback(async () => {
    const res = await window.fetch('/api/staff')
    const json = await res.json()
    if (res.ok) {
      // Không hiện admin trong danh sách phân quyền
      setUsers((json.data ?? []).filter((u: StaffUser) => u.role !== 'admin'))
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  /**
   * loadPermissions — lấy tất cả permissions + permissions của user đang chọn
   */
  async function loadPermissions(userId: number) {
    setLoadingPerms(true)
    try {
      const res = await window.fetch(`/api/permissions?user_id=${userId}`)
      const json = await res.json()
      if (res.ok) {
        setAllPerms(json.data.permissions)
        setCheckedIds(new Set(json.data.userPermissionIds))
      }
    } finally {
      setLoadingPerms(false)
    }
  }

  function handleSelectUser(user: StaffUser) {
    setSelectedUser(user)
    loadPermissions(user.id)
  }

  /**
   * togglePermission — tick/bỏ tick 1 quyền
   */
  function togglePermission(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * toggleGroup — tick/bỏ tick cả nhóm quyền
   */
  function toggleGroup(group_name: string) {
    const groupIds = allPerms.filter((p) => p.group_name === group_name).map((p) => p.id)
    const allChecked = groupIds.every((id) => checkedIds.has(id))

    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (allChecked) groupIds.forEach((id) => next.delete(id))
      else groupIds.forEach((id) => next.add(id))
      return next
    })
  }

  /**
   * handleSave — lưu permissions cho user
   */
  async function handleSave() {
    if (!selectedUser) return
    setSaving(true)
    try {
      const res = await window.fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          permission_ids: [...checkedIds],
        }),
      })
      const json = await res.json()
      if (res.ok) alert(`✅ Đã lưu ${json.data.count} quyền cho ${selectedUser.full_name}`)
      else alert(`❌ ${json.error}`)
    } finally {
      setSaving(false)
    }
  }

  // Nhóm permissions theo group_name
  const grouped = allPerms.reduce(
    (acc, p) => {
      if (!acc[p.group_name]) acc[p.group_name] = []
      acc[p.group_name].push(p)
      return acc
    },
    {} as Record<string, Permission[]>,
  )

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Phân quyền nhân viên</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chọn nhân viên → tick các quyền → Lưu. Admin luôn có full quyền.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Cột trái: Danh sách nhân viên */}
        <div className="w-64 shrink-0">
          <input
            type="text"
            placeholder="Tìm nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${cls.searchInput} w-full mb-3`}
          />
          <div className="space-y-1">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition ${
                  selectedUser?.id === u.id
                    ? 'bg-orange-500 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                } ${!u.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{u.full_name}</p>
                    <p
                      className={`text-xs ${selectedUser?.id === u.id ? 'text-orange-100' : 'text-gray-400'}`}
                    >
                      @{u.username}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md ${
                      selectedUser?.id === u.id
                        ? 'bg-orange-400 text-white'
                        : (ROLE_BADGE[u.role] ?? cls.badgeGray)
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Không có nhân viên</p>
            )}
          </div>
        </div>

        {/* Cột phải: Danh sách permissions */}
        <div className="flex-1">
          {!selectedUser ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              ← Chọn nhân viên để phân quyền
            </div>
          ) : loadingPerms ? (
            <div className="text-center py-16 text-gray-400">Đang tải...</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedUser.full_name}</h2>
                  <p className="text-xs text-gray-400">
                    {checkedIds.size} / {allPerms.length} quyền được cấp
                  </p>
                </div>
                <div className="flex gap-2">
                  {/* Chọn tất cả / Bỏ tất cả */}
                  <button
                    onClick={() => setCheckedIds(new Set(allPerms.map((p) => p.id)))}
                    className={cls.btnSecondary}
                  >
                    Chọn tất cả
                  </button>
                  <button onClick={() => setCheckedIds(new Set())} className={cls.btnSecondary}>
                    Bỏ tất cả
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`${cls.btnPrimary} disabled:opacity-50`}
                  >
                    {saving ? 'Đang lưu...' : '💾 Lưu quyền'}
                  </button>
                </div>
              </div>

              {/* Permission groups */}
              <div className="space-y-4">
                {Object.entries(grouped).map(([group_name, perms]) => {
                  const groupIds = perms.map((p) => p.id)
                  const allChecked = groupIds.every((id) => checkedIds.has(id))
                  const someChecked = groupIds.some((id) => checkedIds.has(id))

                  return (
                    <div
                      key={group_name}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                    >
                      {/* Group header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => toggleGroup(group_name)}
                      >
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked
                          }}
                          onChange={() => toggleGroup(group_name)}
                          className="w-4 h-4 accent-orange-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-semibold text-gray-800">{group_name}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {groupIds.filter((id) => checkedIds.has(id)).length}/{groupIds.length}
                        </span>
                      </div>

                      {/* Permission items */}
                      <div className="divide-y divide-gray-100">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-orange-50 transition"
                          >
                            <input
                              type="checkbox"
                              checked={checkedIds.has(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="w-4 h-4 accent-orange-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm text-gray-800">{perm.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{perm.code}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
