// src/components/admin/StaffFormModal.tsx
'use client'
import { useEffect, useState } from 'react'
import { StaffMember, EmployeeType } from '@/hooks/useStaff'

interface Props {
  staff: StaffMember | null
  employeeTypes: EmployeeType[]
  onClose: () => void
  onSaved: () => void
}

const ROLES = [
  { value: 'waiter', label: '🛎️ Phục vụ' },
  { value: 'chef',   label: '👨‍🍳 Bếp' },
  { value: 'admin',  label: '⚙️ Admin' },
]

export default function StaffFormModal({ staff, employeeTypes, onClose, onSaved }: Props) {
  const isEdit = !!staff
  const profile = staff?.employee_profiles

  const [form, setForm] = useState({
    // Tài khoản
    username:          staff?.username ?? '',
    password:          '',
    full_name:         staff?.full_name ?? '',
    phone:             staff?.phone ?? '',
    role:              staff?.role ?? 'waiter',
    is_active:         staff?.is_active ?? true,
    // Hồ sơ nhân viên
    employee_type_id:  profile?.employee_types?.id ?? '',
    hire_date:         profile?.hire_date ?? '',
    id_card:           profile?.id_card ?? '',
    bank_account:      profile?.bank_account ?? '',
    bank_name:         profile?.bank_name ?? '',
    address:           profile?.address ?? '',
    emergency_contact: profile?.emergency_contact ?? '',
    note:              profile?.note ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [tab, setTab]       = useState<'account' | 'profile'>('account')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.full_name.trim()) { setError('Họ tên không được trống'); return }
    if (!isEdit && !form.username.trim()) { setError('Username không được trống'); return }
    if (!isEdit && form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return }
    if (isEdit && form.password && form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return }

    setSaving(true)
    const payload = isEdit
      ? { id: staff!.id, ...form, employee_type_id: form.employee_type_id || null }
      : { ...form, employee_type_id: form.employee_type_id || null }

    const res  = await window.fetch('/api/staff', {
      method:  isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) setError(json.error ?? 'Có lỗi xảy ra')
    else onSaved()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <h2 className='text-lg font-semibold'>{isEdit ? 'Sửa nhân viên' : 'Thêm nhân viên'}</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
        </div>

        {/* Tabs */}
        <div className='flex border-b px-6'>
          {(['account', 'profile'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
                tab === t ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'account' ? '🔐 Tài khoản' : '📋 Hồ sơ'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>
          {error && <div className='bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg'>{error}</div>}

          {tab === 'account' && (
            <>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Username *</label>
                  <input
                    className={inputCls}
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    disabled={isEdit}
                    placeholder='vd: nguyen_van_a'
                  />
                </div>
                <div>
                  <label className={labelCls}>{isEdit ? 'Mật khẩu mới' : 'Mật khẩu *'}</label>
                  <input
                    type='password'
                    className={inputCls}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={isEdit ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Họ tên *</label>
                <input
                  className={inputCls}
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder='Nguyễn Văn A'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Số điện thoại</label>
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder='0901234567'
                  />
                </div>
                <div>
                  <label className={labelCls}>Vai trò *</label>
                  <select
                    className={inputCls}
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isEdit && (
                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className='text-sm text-gray-700'>{form.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span>
                </div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Loại nhân viên</label>
                  <select
                    className={inputCls}
                    value={form.employee_type_id}
                    onChange={(e) => setForm((f) => ({ ...f, employee_type_id: e.target.value }))}
                  >
                    <option value=''>-- Chọn loại --</option>
                    {employeeTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.default_hourly_rate.toLocaleString('vi-VN')}đ/h)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ngày vào làm</label>
                  <input
                    type='date'
                    className={inputCls}
                    value={form.hire_date}
                    onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Số CCCD</label>
                <input className={inputCls} value={form.id_card} onChange={(e) => setForm((f) => ({ ...f, id_card: e.target.value }))} placeholder='012345678901' />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Số tài khoản</label>
                  <input className={inputCls} value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} placeholder='0123456789' />
                </div>
                <div>
                  <label className={labelCls}>Ngân hàng</label>
                  <input className={inputCls} value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder='Vietcombank' />
                </div>
              </div>

              <div>
                <label className={labelCls}>Địa chỉ</label>
                <input className={inputCls} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder='123 Đường ABC, Quận 1, TP.HCM' />
              </div>

              <div>
                <label className={labelCls}>Liên hệ khẩn cấp</label>
                <input className={inputCls} value={form.emergency_contact} onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))} placeholder='Nguyễn Thị B - 0901234567' />
              </div>

              <div>
                <label className={labelCls}>Ghi chú</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder='Ghi chú thêm...'
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className='flex gap-3 px-6 py-4 border-t'>
          <button type='button' onClick={onClose} className='flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition'>
            Hủy
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={saving}
            className='flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50'
          >
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm nhân viên'}
          </button>
        </div>
      </div>
    </div>
  )
}