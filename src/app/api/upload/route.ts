// src/app/api/upload/route.ts
import { NextRequest } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireRole } from '@/utils/api'
import { requireAnyPermission } from '@/utils/api-auth'
// import required permissions and utilities from your project as needed
import { getUserFromRequest } from '@/utils/api-auth'
import { ApiResponse } from '@/utils/api-response'
import { permission } from 'process'
const s3 = new S3Client({
  forcePathStyle: true,
  region: process.env.SUPABASE_S3_REGION ?? 'ap-southeast-1',
  endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/s3`,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
})

// POST /api/upload — Upload ảnh lên Supabase Storage bucket "products"
export async function POST(request: NextRequest) {
  console.log(' ĐÃ VÀO ĐƯỢC ROUTE UPLOAD')
  // check permission
  const { user, error } = requireAnyPermission(request, [
    'menu.create',
    'menu.update',
    'menu.delete',
  ])

  if (error) {
    console.log('Dừng lại vì lỗi quyền:', error)
    return error
  }
  // khớp quyền với user
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return ApiResponse.error('Không có file')

    // ... (Các bước validate file và buffer) ...
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // 3. Thực hiện S3 Send
    await s3.send(
      new PutObjectCommand({
        Bucket: 'products',
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      }),
    )

    // 4. Trả về kết quả
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${fileName}`

    return ApiResponse.success({ url: publicUrl }, 201)
  } catch (err: any) {
    console.error('[upload] Error:', err)
    return ApiResponse.error(`Lỗi hệ thống: ${err.message}`, 500)
  }
}
// DELETE /api/upload?url=... — Xóa ảnh khỏi Supabase Storage
export async function DELETE(request: NextRequest) {
  const { error: authError } = requireRole(request, ['admin'])
  if (authError) return authError

  const { url } = await request.json()
  if (!url) return ApiResponse.error('Thiếu url')

  const bucketUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/`
  if (!url.startsWith(bucketUrl)) return ApiResponse.error('URL không hợp lệ')

  const fileName = url.replace(bucketUrl, '')

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: 'products',
        Key: fileName,
      }),
    )
  } catch (err: any) {
    console.error('[upload] S3 delete error:', err)
    return ApiResponse.error(`Xóa thất bại: ${err.message}`, 500)
  }

  return ApiResponse.success({ url })
}
