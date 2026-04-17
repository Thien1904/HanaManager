'use client'
import { usePermission } from '@/components/admin/permissions/usePermission'
import UserList from '@/components/admin/permissions/UserList'
import PermissionContent from '@/components/admin/permissions/PermissionConntent'

export default function PermissionManager() {
  const { users, selectedUser, actions, search, setSearch, ...state } = usePermission()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Phân quyền nhân viên</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chọn nhân viên → tick các quyền → Lưu. Admin luôn có full quyền.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Cột trái */}
        <UserList
          users={users}
          selectedId={selectedUser?.id}
          onSelect={actions.handleSelectUser}
          search={search}
          onSearchChange={setSearch}
        />

        {/* Cột phải */}
        <div className="flex-1 min-h-[500px]">
          {selectedUser ? (
            <PermissionContent user={selectedUser} state={state} actions={actions} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
              <span className="text-4xl mb-2">←</span>
              <p>Chọn một nhân viên từ danh sách để phân quyền</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
