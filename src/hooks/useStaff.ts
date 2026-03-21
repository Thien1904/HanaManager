// src/hooks/useStaff.ts
'use client'
import { useState, useEffect, useCallback } from 'react'

export interface EmployeeType {
  id: number
  name: string
  default_hourly_rate: number
}

export interface StaffMember {
  id: number
  username: string
  full_name: string
  phone: string | null
  role: 'admin' | 'waiter' | 'chef'
  is_active: boolean
  created_at: string
  employee_profiles: {
    id: number
    hire_date: string | null
    id_card: string | null
    bank_account: string | null
    bank_name: string | null
    address: string | null
    emergency_contact: string | null
    is_active: boolean
    note: string | null
    employee_types: EmployeeType | null
  } | null
}

export function useStaff() {
  const [staff, setStaff]               = useState<StaffMember[]>([])
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [staffRes, typeRes] = await Promise.all([
        window.fetch('/api/staff'),
        window.fetch('/api/employee-types'),
      ])
      const [staffJson, typeJson] = await Promise.all([
        staffRes.json(),
        typeRes.json(),
      ])
      if (!staffRes.ok) throw new Error(staffJson.error ?? 'Không thể tải nhân viên')
      if (!typeRes.ok) throw new Error(typeJson.error ?? 'Không thể tải loại nhân viên')
      setStaff(staffJson.data)
      setEmployeeTypes(typeJson.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { staff, employeeTypes, loading, error, refresh: load }
}