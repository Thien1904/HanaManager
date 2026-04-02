import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requirePermission(request: NextRequest, permission: string) {
  const supabase = await createClient()

  // 🔥 lấy user từ Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // 🔥 lấy permissions từ DB
  const { data: perms } = await supabase
    .from('user_permissions')
    .select('permissions(code)')
    .eq('user_id', user.id)

  const permissionCodes = perms?.map((p: any) => p.permissions.code) ?? []

  // 🔥 check quyền
  if (!permissionCodes.includes(permission)) {
    return {
      user,
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user, error: null }
}
