//src/app/api/staff/[id]/permission/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const supabase = createAdminClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // 👈 sửa type
) {
  const { id } = await params

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('user_permissions')
    .select('permissions(code)')
    .eq('user_id', Number(id))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const codes = (data ?? []).map((p: any) => p.permissions.code)

  return NextResponse.json(codes)
}
