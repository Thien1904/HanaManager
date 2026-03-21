// src/hooks/useKitchenTickets.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export interface KitchenItem {
  name:     string
  quantity: number
  notes:    string
  category: string
}

export interface KitchenTicket {
  id:              number
  status:          'sent' | 'acknowledged' | 'completed' | 'cancelled'
  note:            string | null
  sent_at:         string
  acknowledged_at: string | null
  items_snapshot:  KitchenItem[]
  orders:          { id: number; status: string } | null
  tables:          { table_number: string }       | null
  users:           { full_name: string }          | null
}

export function useKitchenTickets() {
  const [tickets, setTickets]   = useState<KitchenTicket[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Fetch danh sách ticket đang chờ + đang nấu
  const fetchTickets = useCallback(async () => {
    try {
      setError(null)
      const res  = await fetch('/api/kitchen?status=sent,acknowledged,cancelled')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTickets(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()

    // Khởi tạo Supabase client phía browser để lắng nghe Realtime
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Đăng ký channel lắng nghe bảng kitchen_tickets
    const channel = supabase
      .channel('kitchen-tickets-changes')
      .on(
        'postgres_changes',
        {
          event:  '*',       // lắng nghe INSERT, UPDATE, DELETE
          schema: 'public',
          table:  'kitchen_tickets',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Ticket mới → fetch lại để có đầy đủ JOIN data
            // (Realtime payload không có JOIN, chỉ có raw row)
            const res = await fetch(`/api/kitchen?status=sent,acknowledged,cancelled`)
            const json = await res.json()
            if (res.ok) setTickets(json.data)

          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any
            setTickets(prev =>
              prev
                // Cập nhật ticket đã đổi status
                .map(t => t.id === updated.id ? { ...t, ...updated } : t)
                // Lọc bỏ ticket đã completed/cancelled khỏi màn hình
               .filter(t => !['completed', 'dismissed'].includes(t.status))
            )
          }
        }
      )
      .subscribe()

    // Cleanup khi component unmount — quan trọng để tránh memory leak
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTickets])

  return { tickets, loading, error, refresh: fetchTickets }
}