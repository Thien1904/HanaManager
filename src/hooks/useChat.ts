// ============================================================
// FILE: src/hooks/useChat.ts
// NGÔN NGỮ: TypeScript — Custom React Hook (Client-side)
// MỤC ĐÍCH: Quản lý state của cuộc hội thoại với AI
//           Gửi câu hỏi, nhận câu trả lời, lưu history local
//
// LUỒNG CHẠY:
//   1. Component gọi useChat()
//   2. User gửi message → sendMessage()
//   3. Hook thêm message vào local state ngay (optimistic update)
//   4. Gọi POST /api/chat, chờ Gemini trả lời
//   5. Thêm câu trả lời vào state
//   6. Component re-render hiển thị tin nhắn mới
// ============================================================
// ============================================================
// FILE: src/hooks/useChat.ts
// MỤC ĐÍCH: Quản lý state chat + tự động load lịch sử khi mở
// ============================================================
// ============================================================
// FILE: src/hooks/useChat.ts
// ============================================================

'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  isLoading?: boolean
}

export function useChat() {
  const [messages, setMessages]             = useState<ChatMessage[]>([])
  const [loading, setLoading]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)

  // Dùng ref để tránh stale closure khi gửi message
  // Ref luôn giữ giá trị mới nhất, không bị đóng băng như state trong callback
  const conversationIdRef = useRef<number | null>(null)
  const bottomRef         = useRef<HTMLDivElement>(null)

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Helper set cả state lẫn ref cùng lúc
  function setConvId(id: number | null) {
    setConversationId(id)
    conversationIdRef.current = id
  }

  // ── Load lịch sử khi mở chat ──
  // Quan trọng: set ref ngay khi load xong
  // để lần POST đầu tiên đã có conversationId đúng
  useEffect(() => {
    async function loadHistory() {
      try {
        const res  = await window.fetch('/api/chat')
        const json = await res.json()
        if (!res.ok || !json.data?.messages?.length) return

        const history: ChatMessage[] = json.data.messages.map((m: any) => ({
          id:        String(m.id),
          role:      m.role as 'user' | 'assistant',
          content:   m.content,
          createdAt: new Date(m.created_at),
        }))

        setMessages(history)
        // Set cả state lẫn ref — đảm bảo POST đầu tiên gửi đúng conversationId
        setConvId(json.data.conversationId)
        scrollToBottom()
      } catch (err) {
        console.warn('[useChat] load history failed:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [])

  // ── Gửi tin nhắn ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user',
      content: text.trim(), createdAt: new Date(),
    }
    const loadingMsg: ChatMessage = {
      id: 'loading', role: 'assistant',
      content: '', createdAt: new Date(), isLoading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)
    scrollToBottom()

    try {
      const res  = await window.fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:        text.trim(),
          conversationId: conversationIdRef.current, // Luôn dùng ref — không bao giờ stale
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'AI không phản hồi')

      // Set cả state lẫn ref khi nhận conversationId mới
      if (json.data.conversationId) setConvId(json.data.conversationId)

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: json.data.answer, createdAt: new Date(),
      }
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), assistantMsg])
    } catch (err: any) {
      setError(err.message)
      setMessages(prev => prev.filter(m => m.id !== 'loading'))
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }, [loading]) // Không cần conversationId trong deps vì dùng ref

  // ── Xóa chat, bắt đầu hội thoại mới ──
  const clearChat = useCallback(() => {
    setMessages([])
    setConvId(null)
    setError(null)
  }, [])

  return { messages, loading, loadingHistory, error, bottomRef, sendMessage, clearChat }
}