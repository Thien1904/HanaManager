'use client'
// src/app/(dashboard)/admin/reports/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'

interface Summary {
  today: { date: string; totalOrders: number; totalRevenue: number; totalCancelled: number }
  topProducts:     { name: string; qty: number }[]
  discountOrders:  { id: number; total_price: number; discount_amount: number; created_at: string; tables: any; users: any }[]
  cancelledDetail: { id: number; orderId: number; productName: string; cancelQty: number; createdAt: string }[]
}

const BAR_COLORS = ['#00d4ff','#00b8d9','#009cb8','#0080a0','#006888','#005070','#003858','#002440','#001428','#000c10']

function ListModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-3">{children}</div>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-xl">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-[#00d4ff] font-bold">{payload[0].value} phần</p>
    </div>
  )
}

function StatCard({ label, value, sub, onClick, accent }: {
  label: string; value: string|number; sub?: string; onClick?: () => void; accent?: string
}) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-black ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {onClick && <p className="text-xs text-blue-500 mt-2 font-medium">Xem chi tiết →</p>}
    </div>
  )
}

export default function ReportsPage() {
  const router = useRouter()
  const [data,    setData]    = useState<Summary|null>(null)
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'cancelled'|'discounts'|null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res  = await fetch('/api/reports/summary')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json.data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"/>
    </div>
  )

  if (!data) return null
  const { today, topProducts, discountOrders, cancelledDetail } = data

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Báo cáo doanh thu</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Hôm nay — {new Date().toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm">🔄 Cập nhật</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Số đơn hôm nay" value={today.totalOrders} sub="Đơn chưa bị huỷ" accent="text-blue-600"/>
        <StatCard label="Doanh thu hôm nay" value={`${(today.totalRevenue/1000000).toFixed(2)}M`} sub={`${today.totalRevenue.toLocaleString('vi-VN')}đ`} accent="text-green-600"/>
        <StatCard label="Số lượng món huỷ" value={today.totalCancelled} sub="Hôm nay — nhấn để xem" accent="text-red-500" onClick={() => setModal('cancelled')}/>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">🏆 Top 10 món bán chạy hôm nay</h2>
          <span className="text-xs text-gray-400">Theo số lượng</span>
        </div>
        {topProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <p className="text-4xl mb-2">📊</p>
            <p>Chưa có dữ liệu hôm nay</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topProducts} layout="vertical" margin={{ left:16, right:40, top:4, bottom:4 }}>
              <XAxis type="number" tick={{ fontSize:12, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize:12, fill:'#374151' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="qty" radius={[0,6,6,0]} maxBarSize={28} label={{ position:'right', fontSize:11, fill:'#6b7280' }}>
                {topProducts.map((_,i) => <Cell key={i} fill={BAR_COLORS[i] ?? '#006888'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">🏷️ Hoạt động giảm giá gần đây</h2>
          <button onClick={() => setModal('discounts')} className="text-xs text-blue-500 hover:underline font-medium">Xem tất cả →</button>
        </div>
        {discountOrders.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">Chưa có bill giảm giá nào</p>
        ) : (
          <div className="space-y-2">
            {discountOrders.slice(0,5).map(o => (
              <div key={o.id} onClick={() => router.push(`/waiter/orders/${o.id}`)}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">Order #{o.id} — Bàn {o.tables?.table_number ?? '?'}</p>
                  <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('vi-VN')} · {o.users?.full_name ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{(o.total_price - o.discount_amount).toLocaleString('vi-VN')}đ</p>
                  <p className="text-xs text-green-600 font-medium">−{o.discount_amount.toLocaleString('vi-VN')}đ</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'cancelled' && (
        <ListModal title={`Món huỷ hôm nay (${today.totalCancelled} phần)`} onClose={() => setModal(null)}>
          {cancelledDetail.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">Không có món nào bị huỷ hôm nay</p>
          ) : (
            <div className="space-y-2">
              {cancelledDetail.map((item,i) => (
                <div key={i} onClick={() => { setModal(null); router.push(`/waiter/orders/${item.orderId}`) }}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-red-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">−{item.cancelQty} phần</p>
                    <p className="text-xs text-blue-400">Order #{item.orderId}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListModal>
      )}

      {modal === 'discounts' && (
        <ListModal title="Tất cả bill có giảm giá" onClose={() => setModal(null)}>
          {discountOrders.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">Chưa có bill giảm giá nào</p>
          ) : (
            <div className="space-y-2">
              {discountOrders.map(o => (
                <div key={o.id} onClick={() => { setModal(null); router.push(`/waiter/orders/${o.id}`) }}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Order #{o.id} — Bàn {o.tables?.table_number ?? '?'}</p>
                    <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('vi-VN')} · {o.users?.full_name ?? '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{(o.total_price - o.discount_amount).toLocaleString('vi-VN')}đ</p>
                    <p className="text-xs text-green-600 font-medium">−{o.discount_amount.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListModal>
      )}
    </div>
  )
}