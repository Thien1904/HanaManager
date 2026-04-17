import { Permission } from '@/types/permission'

interface PermissionBoxProps {
  groupName: string
  permissions: Permission[]
  checkedIds: Set<number>
  onToggleGroup: () => void
  onTogglePermission: (id: number) => void
}

export default function PermissionBox({
  groupName,
  permissions,
  checkedIds,
  onToggleGroup,
  onTogglePermission,
}: PermissionBoxProps) {
  const groupIds = permissions.map((p) => p.id)
  const allChecked = groupIds.every((id) => checkedIds.has(id))
  const someChecked = groupIds.some((id) => checkedIds.has(id)) && !allChecked

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:border-orange-200 transition-colors">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 border-b border-gray-100 cursor-pointer hover:bg-gray-100"
        onClick={onToggleGroup}
      >
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked
          }}
          onChange={onToggleGroup}
          className="w-4 h-4 accent-orange-500 rounded"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="font-bold text-gray-700 text-sm uppercase tracking-wider">
          {groupName}
        </span>
      </div>

      <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
        {permissions.map((perm) => (
          <label
            key={perm.id}
            className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              checkedIds.has(perm.id)
                ? 'bg-orange-50 text-orange-900'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <input
              type="checkbox"
              checked={checkedIds.has(perm.id)}
              onChange={() => onTogglePermission(perm.id)}
              className="mt-1 w-4 h-4 accent-orange-500 rounded"
            />
            <div>
              <p className="text-sm font-medium leading-tight">{perm.name}</p>
              <p className="text-[10px] font-mono opacity-60 mt-0.5">{perm.code}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
