// src/components/admin/permissions/usePermission.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import { StaffUser, Permission, UserPermissionsData } from '@/types/permission'
import { ApiResponse } from '@/utils/api-response'

export function usePermission() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null)
  const [allPerms, setAllPerms] = useState<Permission[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())

  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  /**
   * 1. Load danh sách nhân viên
   */
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await window.fetch('/api/staff')
      const json = await res.json()
      if (res.ok) {
        // Lọc bỏ admin vì admin mặc định có full quyền
        const staffOnly = (json.data ?? []).filter((u: any) => u.role !== 'admin')

        // Map dữ liệu về camelCase nếu cần
        setUsers(
          staffOnly.map((u: any) => ({
            id: u.id,
            username: u.username,
            fullName: u.full_name, // Map snake_case -> camelCase
            role: u.role,
            isActive: u.is_active,
          })),
        )
      }
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  /**
   * 2. Load danh sách quyền của một User cụ thể
   */
  async function loadPermissions(userId: number) {
    setLoadingPerms(true)
    try {
      const res = await window.fetch(`/api/permissions?user_id=${userId}`)
      const json = await res.json()
      if (res.ok) {
        const data: UserPermissionsData = json.data

        // Map permissions từ DB sang camelCase
        const formattedPerms = data.permissions.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          groupName: p.group_name, // Map snake_case -> camelCase
        }))

        setAllPerms(formattedPerms)
        console.log('Danh sách quyền đã load:', formattedPerms)
        setCheckedIds(new Set(data.userPermissionIds))
      }
    } finally {
      setLoadingPerms(false)
    }
  }

  /**
   * 3. Các hàm xử lý Logic (Actions)
   */
  const actions = {
    handleSelectUser: (user: StaffUser) => {
      setSelectedUser(user)
      loadPermissions(user.id)
    },

    togglePermission: (id: number) => {
      setCheckedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },

    toggleGroup: (groupName: string) => {
      const groupIds = allPerms.filter((p) => p.groupName === groupName).map((p) => p.id)

      const isAllChecked = groupIds.every((id) => checkedIds.has(id))

      setCheckedIds((prev) => {
        const next = new Set(prev)
        if (isAllChecked) groupIds.forEach((id) => next.delete(id))
        else groupIds.forEach((id) => next.add(id))
        return next
      })
    },

    bulkCheck: (isAll: boolean) => {
      if (isAll) {
        setCheckedIds(new Set(allPerms.map((p) => p.id)))
      } else {
        setCheckedIds(new Set())
      }
    },

    handleSave: async () => {
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
        if (res.ok) {
          alert(`✅ Đã lưu quyền cho ${selectedUser.fullName}`)
        } else {
          alert(`❌ Lỗi: ${json.error}`)
        }
      } finally {
        setSaving(false)
      }
    },
  }

  /**
   * 4. Dữ liệu đã qua xử lý (Memoized Selectors)
   */
  const groupedPerms = useMemo(() => {
    return allPerms.reduce(
      (acc, p) => {
        if (!acc[p.groupName]) acc[p.groupName] = []
        acc[p.groupName].push(p)
        return acc
      },
      {} as Record<string, Permission[]>,
    )
  }, [allPerms])

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()),
    )
  }, [users, search])

  return {
    // States
    users: filteredUsers,
    selectedUser,
    checkedIds,
    groupedPerms,
    allPermsCount: allPerms.length,

    // Status
    loadingUsers,
    loadingPerms,
    saving,
    search,

    // Setters & Actions
    setSearch,
    actions,
  }
}
