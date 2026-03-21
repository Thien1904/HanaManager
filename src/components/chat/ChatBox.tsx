// ============================================================
// FILE: src/components/chat/ChatBox.tsx
// NGÔN NGỮ: TypeScript + React (Client Component)
// MỤC ĐÍCH: Giao diện chat với AI — hiển thị messages,
//           input gửi câu hỏi, quick prompts gợi ý
//
// LUỒNG CHẠY:
//   1. Render danh sách messages từ useChat()
//   2. User nhập câu hỏi hoặc click quick prompt
//   3. Gọi sendMessage() từ hook
//   4. Hiển thị typing indicator khi chờ AI
//   5. Render câu trả lời khi có
// ============================================================
// ============================================================
// FILE: src/components/chat/ChatBox.tsx
// ============================================================

'use client'
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'

const QUICK_PROMPTS = [
  { label: 'Doanh thu hôm nay',      prompt: 'Doanh thu hôm nay là bao nhiêu?' },
  { label: 'Món bán chạy tuần này',  prompt: 'Tuần này món nào bán chạy nhất?' },
  { label: 'Món bán chậm',           prompt: 'Món nào bán chậm nhất tháng này?' },
  { label: 'Tổng đơn tuần này',      prompt: 'Tổng số đơn hàng tuần này?' },
  { label: 'Trạng thái bàn',         prompt: 'Hiện tại còn bao nhiêu bàn trống?' },
  { label: 'Gợi ý giảm giá',         prompt: 'Gợi ý món nên giảm giá để đẩy hàng?' },
]

export default function ChatBox() {
  const { messages, loading, loadingHistory, error, bottomRef, sendMessage, clearChat } = useChat()
  const [input, setInput]   = useState('')
  const inputRef            = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any) }
  }

  return (
    <div className='flex flex-col h-full max-w-3xl mx-auto'>

      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
        <div className='flex items-center gap-3'>
          <div className='w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-lg'>🤖</div>
          <div>
            <p className='font-semibold text-gray-900 text-sm'>Trợ lý AI nhà hàng</p>
            <p className='text-xs text-gray-400'>Powered by Groq • Dữ liệu thời gian thực</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className='text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition'>
            Cuộc hội thoại mới
          </button>
        )}
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>

        {/* Loading lịch sử */}
        {loadingHistory && (
          <div className='text-center py-8 text-gray-400 text-sm'>Đang tải lịch sử chat...</div>
        )}

        {/* Welcome screen */}
        {!loadingHistory && messages.length === 0 && (
          <div className='text-center py-8'>
            <div className='text-4xl mb-3'>🤖</div>
            <p className='text-gray-700 font-medium mb-1'>Xin chào! Tôi có thể giúp gì cho bạn?</p>
            <p className='text-sm text-gray-400 mb-6'>Hỏi tôi về doanh thu, món ăn, nhân viên...</p>
            <div className='grid grid-cols-2 gap-2 max-w-lg mx-auto'>
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.prompt}
                  onClick={() => sendMessage(qp.prompt)}
                  className='text-left px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600
                             hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition'
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className='w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm flex-shrink-0 mt-1'>🤖</div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.isLoading ? (
                <div className='flex gap-1 items-center py-1'>
                  <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }}/>
                  <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }}/>
                  <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }}/>
                </div>
              ) : (
                <p className='whitespace-pre-wrap'>{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className='w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs flex-shrink-0 mt-1'>U</div>
            )}
          </div>
        ))}

        {error && (
          <div className='bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100'>{error}</div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className='px-6 py-4 border-t border-gray-100'>
        <form onSubmit={handleSubmit} className='flex gap-3 items-end'>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Hỏi về doanh thu, món bán chạy... (Enter để gửi)'
            rows={1}
            className='flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-400 max-h-32 overflow-y-auto'
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          <button
            type='submit'
            disabled={loading || !input.trim()}
            className='px-4 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium
                       hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0'
          >
            {loading ? '...' : 'Gửi'}
          </button>
        </form>
        <p className='text-xs text-gray-400 mt-2 text-center'>Enter để gửi • Shift+Enter để xuống dòng</p>
      </div>

    </div>
  )
}