// src/app/api/employee-types/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('employee_types')
    .select('id, name, default_hourly_rate, overtime_rate, is_active')
    .eq('is_active', true)
    .order('name')

  if (dbError) return ApiResponse.error('Không thể tải loại nhân viên', 500)

  return ApiResponse.success(data)
}