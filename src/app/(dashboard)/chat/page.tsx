// ============================================================
// FILE: src/app/(dashboard)/chat/page.tsx
// NGÔN NGỮ: TypeScript — Next.js Page (Server Component)
// MỤC ĐÍCH: Entry point cho trang /chat
// ============================================================

import ChatBox from '@/components/chat/ChatBox'

export const metadata = { title: 'AI Chat — Trợ lý nhà hàng' }

export default function ChatPage() {
  return (
    <div className='h-[calc(100vh-64px)] flex flex-col'>
      <ChatBox />
    </div>
  )
}