// ============================================================
// FILE: src/app/api/chat/route.ts
// ============================================================

import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

// ============================================================
// Phân loại câu hỏi
// ============================================================
function classifyQuestion(q: string): 'restaurant' | 'general' | 'casual' {
  const lower = q.toLowerCase()
  const casualKeywords = [
    'bạn khỏe',
    'khỏe không',
    'chào',
    'hello',
    'hi ',
    'xin chào',
    'cảm ơn',
    'thank',
    'tạm biệt',
    'bye',
    'bạn là ai',
    'bạn tên gì',
  ]
  const restaurantKeywords = [
    'doanh thu',
    'bán',
    'order',
    'đơn hàng',
    'tiền',
    'món',
    'bàn',
    'nhân viên',
    'hủy',
    'thanh toán',
    'khách',
    'ca làm',
    'thực đơn',
    'menu',
    'lương',
    'bếp',
    'phục vụ',
    'table',
  ]
  if (casualKeywords.some((k) => lower.includes(k))) return 'casual'
  if (restaurantKeywords.some((k) => lower.includes(k))) return 'restaurant'
  return 'general'
}

// ============================================================
// Query DB và tính toán số liệu tóm tắt
// ============================================================
async function buildRestaurantSummary(question: string): Promise<string> {
  const supabase = createAdminClient()
  const q = question.toLowerCase()
  const lines: string[] = []

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(today.getDate() - 30)

  // ── Đơn hàng cuối cùng ──
  if (q.match(/cuối|gần nhất|mới nhất|last/)) {
    const { data } = await supabase
      .from('orders')
      .select(
        `
        id, total_price, payment_method, created_at, status,
        tables ( table_number ),
        order_items ( quantity, products ( name ) )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const items = (data.order_items as any[])
        ?.map((i: any) => `${i.products?.name} x${i.quantity}`)
        .join(', ')
      lines.push(`Đơn hàng cuối: #${data.id}`)
      lines.push(`  Bàn: ${(data.tables as any)?.table_number ?? 'N/A'}`)
      lines.push(`  Món: ${items || 'Không có'}`)
      lines.push(`  Tổng: ${Number(data.total_price).toLocaleString('vi-VN')}đ`)
      lines.push(`  Thời gian: ${new Date(data.created_at).toLocaleString('vi-VN')}`)
    } else {
      lines.push('Chưa có đơn hàng nào')
    }
  }

  // ── Doanh thu ──
  if (q.match(/doanh thu|tiền|thu nhập|hôm nay|tuần|tháng/)) {
    const { data: orders } = await supabase
      .from('orders')
      .select('total_price, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', monthAgo.toISOString())

    if (orders?.length) {
      const todayOrders = orders.filter((o) => o.created_at.startsWith(todayStr))
      const weekOrders = orders.filter((o) => new Date(o.created_at) >= weekAgo)
      const sum = (arr: typeof orders) => arr.reduce((s, o) => s + Number(o.total_price), 0)
      lines.push(
        `Doanh thu hôm nay: ${sum(todayOrders).toLocaleString('vi-VN')}đ (${todayOrders.length} đơn)`,
      )
      lines.push(
        `Doanh thu 7 ngày: ${sum(weekOrders).toLocaleString('vi-VN')}đ (${weekOrders.length} đơn)`,
      )
      lines.push(
        `Doanh thu 30 ngày: ${sum(orders).toLocaleString('vi-VN')}đ (${orders.length} đơn)`,
      )
    } else {
      lines.push('Chưa có đơn hàng nào được thanh toán')
    }
  }

  // ── Món bán chạy ──
  if (q.match(/món|bán chạy|phổ biến|nhiều nhất|ít nhất/)) {
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, products ( name ), orders!inner ( created_at, payment_status )')
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', weekAgo.toISOString())

    if (items?.length) {
      const map: Record<string, number> = {}
      items.forEach((item: any) => {
        const name = item.products?.name ?? 'Không rõ'
        map[name] = (map[name] ?? 0) + item.quantity
      })
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
      lines.push('Top 5 món bán chạy 7 ngày:')
      sorted.slice(0, 5).forEach(([name, qty], i) => lines.push(`  ${i + 1}. ${name}: ${qty} phần`))
      if (sorted.length > 0) {
        const last = sorted[sorted.length - 1]
        lines.push(`Món bán chậm nhất: ${last[0]} (${last[1]} phần)`)
      }
    } else {
      lines.push('Không có dữ liệu bán hàng trong 7 ngày qua')
    }
  }

  // ── Bàn ──
  if (q.match(/bàn|table|trống|occupied/)) {
    const { data: tables } = await supabase.from('tables').select('table_number, status')
    if (tables?.length) {
      const available = tables.filter((t) => t.status === 'available')
      const occupied = tables.filter((t) => t.status === 'occupied')
      lines.push(
        `Bàn trống: ${available.length} (${available.map((t) => t.table_number).join(', ')})`,
      )
      lines.push(`Bàn có khách: ${occupied.length}`)
    }
  }

  // ── Nhân viên ──
  if (q.match(/nhân viên|staff/)) {
    const { data: users } = await supabase.from('users').select('full_name, role, is_active')
    if (users?.length) {
      const active = users.filter((u) => u.is_active)
      const byRole = active.reduce((acc: Record<string, string[]>, u) => {
        if (!acc[u.role]) acc[u.role] = []
        acc[u.role].push(u.full_name)
        return acc
      }, {})
      lines.push(`Nhân viên đang hoạt động: ${active.length}`)
      Object.entries(byRole).forEach(([role, names]) =>
        lines.push(`  - ${role}: ${names.join(', ')}`),
      )
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Không có dữ liệu liên quan'
}

// ============================================================
// POST /api/chat
// ============================================================
export async function POST(request: NextRequest) {
  const { error: authError, user } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (authError) return authError

  const body = await request.json()
  const { message, conversationId } = body
  if (!message?.trim()) return ApiResponse.error('Câu hỏi không được trống')

  const supabase = createAdminClient()
  const questionType = classifyQuestion(message)

  try {
    const today = new Date().toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    type GroqMsg = { role: 'user' | 'assistant' | 'system'; content: string }

    // ── Bước 1: Tìm conversation hiện tại của user ──
    // Ưu tiên conversationId từ client, nếu không có thì tìm conversation
    // gần nhất trong DB — đảm bảo AI luôn nhớ ngữ cảnh trò chuyện
    let activeConvId = conversationId

    if (!activeConvId) {
      const { data: lastConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user!.userId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()
      activeConvId = lastConv?.id ?? null
    }

    // ── Bước 2: Load history từ conversation hiện tại ──
    // Gửi vào Groq để AI nhớ toàn bộ ngữ cảnh (tên user, nội dung đã nói...)
    let history: GroqMsg[] = []
    if (activeConvId) {
      const { data: prev } = await supabase
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true })
        .limit(10) // 10 tin nhắn gần nhất = đủ nhớ ngữ cảnh, không tốn quá nhiều token
      if (prev) {
        history = prev.map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }))
      }
    }

    // ── Bước 3: Tạo conversation mới nếu chưa có ──
    if (!activeConvId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user!.userId,
          mode: 'restaurant_assistant',
          title: message.slice(0, 50),
        })
        .select('id')
        .single()
      activeConvId = conv?.id
    }

    // ── Bước 4: Build system prompt theo loại câu hỏi ──
    let systemContent = ''

    if (questionType === 'casual') {
      systemContent = `Bạn là trợ lý AI thân thiện của nhà hàng. Hôm nay ${today}.
Trả lời tự nhiên, thân thiện bằng tiếng Việt.
Nhớ toàn bộ nội dung cuộc trò chuyện — nếu user đã chia sẻ tên hay thông tin gì thì dùng lại.`
    } else if (questionType === 'general') {
      systemContent = `Bạn là trợ lý AI thông minh của nhà hàng. Hôm nay ${today}.
Trả lời câu hỏi kiến thức chung ngắn gọn, chính xác bằng tiếng Việt.
Nhớ toàn bộ nội dung cuộc trò chuyện — nếu user đã chia sẻ tên hay thông tin gì thì dùng lại.`
    } else {
      const summary = await buildRestaurantSummary(message)
      systemContent = `Bạn là trợ lý AI của nhà hàng. Hôm nay ${today}.

QUY TẮC:
- Nhớ toàn bộ nội dung cuộc trò chuyện — nếu user đã chia sẻ tên hay thông tin gì thì dùng lại
- Chỉ dùng số liệu được cung cấp bên dưới, không bịa đặt
- Nếu không có dữ liệu thì nói thẳng
- Trả lời ngắn gọn bằng tiếng Việt

SỐ LIỆU HIỆN TẠI:
${summary}`
    }

    // ── Bước 5: Gọi Groq với đầy đủ history ──
    // Thứ tự: [system] → [history] → [câu hỏi mới]
    // AI đọc history như 1 cuộc hội thoại liên tục → tự nhớ ngữ cảnh
    const messages: GroqMsg[] = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: message },
    ]

    const completion = await groq.chat.completions.create({
      messages,
      model: MODEL,
      temperature: questionType === 'casual' ? 0.7 : 0.2,
      max_tokens: 512,
    })

    const answer = completion.choices[0]?.message?.content ?? 'Không có câu trả lời'
    const tokensUsed = completion.usage?.total_tokens ?? null

    // ── Bước 6: Lưu vào DB ──
    if (activeConvId) {
      await supabase.from('ai_messages').insert([
        { conversation_id: activeConvId, role: 'user', content: message, tokens_used: null },
        {
          conversation_id: activeConvId,
          role: 'assistant',
          content: answer,
          tokens_used: tokensUsed,
        },
      ])
    }

    return ApiResponse.success({ answer, conversationId: activeConvId })
  } catch (err: any) {
    console.error('[chat] Groq error:', err)
    return ApiResponse.error(`AI không phản hồi: ${err.message}`, 500)
  }
}

// ============================================================
// GET /api/chat — Load 10 tin nhắn gần nhất theo user
// ============================================================
export async function GET(request: NextRequest) {
  const { error: authError, user } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (authError) return authError

  const supabase = createAdminClient()

  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', user!.userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!conv) return ApiResponse.success({ messages: [], conversationId: null })

  const { data: messages, error: dbError } = await supabase
    .from('ai_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (dbError) return ApiResponse.error('Không thể tải lịch sử chat', 500)

  return ApiResponse.success({ messages: messages.reverse(), conversationId: conv.id })
}
