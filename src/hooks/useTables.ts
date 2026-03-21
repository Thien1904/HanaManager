// src/hooks/useTables.ts
// Custom hook — tách logic fetch ra khỏi UI component
// Bất kỳ component nào cần data bàn đều dùng hook này
'use client'
import { useState, useEffect, useCallback } from 'react'

// Type cho data trả về từ API
export interface TableWithOrder {
  id: number
  table_number: string
  status: 'available' | 'occupied' | 'reserved'
  activeOrder: {
    id: number
    status: string
    total_price: number
    created_at: string
    users: { full_name: string } | null
  } | null
}

export function useTables() {
  const [tables, setTables]   = useState<TableWithOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // useCallback: tránh tạo lại function mỗi lần render
  // Dùng dependency array rỗng [] vì hàm này không phụ thuộc state nào
  const fetchTables = useCallback(async () => {
    try {
      setError(null)
      const res  = await fetch('/api/tables')
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Lỗi tải dữ liệu')

      setTables(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Chạy fetchTables khi component mount lần đầu
  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  // Trả về data + hàm refresh để component gọi thủ công khi cần
  return { tables, loading, error, refresh: fetchTables }
}