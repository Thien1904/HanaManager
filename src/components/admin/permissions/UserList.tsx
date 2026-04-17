import { StaffUser } from '@/types/permission'
import { ROLE_BADGE } from '@/utils/constants'
import { cls } from '@/utils/styles'

interface UserListProps {
  users: StaffUser[]
  selectedId?: number
  onSelect: (user: StaffUser) => void
  search: string
  onSearchChange: (val: string) => void
}

export default function UserList({
  users,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: UserListProps) {
  return (
    <div className="w-72 shrink-0">
      <input
        type="text"
        placeholder="Tìm nhân viên..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className={`${cls.searchInput} w-full mb-4`}
      />
      <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              selectedId === u.id
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'hover:bg-gray-100 text-gray-700 bg-white border border-transparent'
            } ${!u.isActive ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{u.fullName}</p>
                <p
                  className={`text-xs ${selectedId === u.id ? 'text-orange-100' : 'text-gray-400'}`}
                >
                  @{u.username}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                  selectedId === u.id
                    ? 'bg-orange-400 text-white'
                    : ROLE_BADGE[u.role] || 'bg-gray-100'
                }`}
              >
                {u.role}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
