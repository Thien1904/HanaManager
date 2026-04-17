import { StaffUser, Permission } from '@/types/permission'
import PermissionBox from '@/components/admin/permissions/PermissionBox'
import { cls } from '@/utils/styles'

interface PermissionContentProps {
  user: StaffUser
  state: {
    loadingPerms: boolean
    saving: boolean
    checkedIds: Set<number>
    groupedPerms: Record<string, Permission[]>
    allPermsCount: number
  }
  actions: {
    togglePermission: (id: number) => void
    toggleGroup: (groupName: string) => void
    bulkCheck: (isAll: boolean) => void
    handleSave: () => void
  }
}

export default function PermissionContent({ user, state, actions }: PermissionContentProps) {
  if (state.loadingPerms) {
    return (
      <div className="text-center py-20 text-gray-400 animate-pulse">
        Đang tải danh sách quyền...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 1. Header cố định phía trên */}
      <div className="flex items-center justify-between bg-white p-4 rounded-t-xl border border-gray-200 shadow-sm z-10">
        <div>
          <h2 className="font-bold text-gray-900">{user.fullName}</h2>
          <p className="text-xs text-gray-500">
            Đã chọn <span className="font-bold text-orange-600">{state.checkedIds.size}</span> /{' '}
            {state.allPermsCount} quyền
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => actions.bulkCheck(true)}
            className="text-xs font-medium text-gray-600 hover:text-orange-600 px-2"
          >
            Chọn hết
          </button>
          <button
            onClick={() => actions.bulkCheck(false)}
            className="text-xs font-medium text-gray-600 hover:text-red-600 px-2"
          >
            Bỏ chọn
          </button>
          <button
            onClick={actions.handleSave}
            disabled={state.saving}
            className={`${cls.btnPrimary} py-1.5 px-4 text-sm disabled:opacity-50`}
          >
            {state.saving ? 'Đang lưu...' : 'Lưu quyền'}
          </button>
        </div>
      </div>

      {/* 2. Vùng chứa danh sách quyền có Scrollbar */}
      <div className="bg-gray-50/30 border-x border-b border-gray-200 rounded-b-xl overflow-hidden">
        <div className="space-y-4 p-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
          {Object.entries(state.groupedPerms).map(([groupName, perms]) => (
            <PermissionBox
              key={groupName}
              groupName={groupName}
              permissions={perms}
              checkedIds={state.checkedIds}
              onToggleGroup={() => actions.toggleGroup(groupName)}
              onTogglePermission={actions.togglePermission}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
