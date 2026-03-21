// src/app/api/test/route.ts
// FILE TẠM ĐỂ DEBUG - XÓA SAU KHI XONG
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Test với service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('users')
      .select('id, username, role')
      .limit(5)

    return NextResponse.json({
      url:    process.env.NEXT_PUBLIC_SUPABASE_URL,
      keyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
      data,
      error:  error?.message,
    })

  } catch (err: any) {
    return NextResponse.json({ crashed: err.message }, { status: 500 })
  }
}
