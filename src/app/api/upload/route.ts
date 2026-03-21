// src/app/api/upload/route.ts
import { NextRequest } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { ApiResponse, requireRole } from '@/utils/api'

const s3 = new S3Client({
  forcePathStyle: true,
  region: process.env.SUPABASE_S3_REGION ?? 'ap-southeast-1',
  endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/s3`,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
})

// POST /api/upload — Upload ảnh lên Supabase Storage bucket "products"
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return ApiResponse.error('Không có file')

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type))
    return ApiResponse.error('Chỉ chấp nhận JPG, PNG, WEBP')

  if (file.size > 5 * 1024 * 1024)
    return ApiResponse.error('Ảnh tối đa 5MB')

  const ext      = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  try {
    await s3.send(new PutObjectCommand({
      Bucket:      'products',
      Key:         fileName,
      Body:        buffer,
      ContentType: file.type,
    }))
  } catch (err: any) {
    console.error('[upload] S3 error:', err)
    return ApiResponse.error(`Upload thất bại: ${err.message}`, 500)
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${fileName}`
  return ApiResponse.success({ url: publicUrl }, 201)
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
    await s3.send(new DeleteObjectCommand({
      Bucket: 'products',
      Key:    fileName,
    }))
  } catch (err: any) {
    console.error('[upload] S3 delete error:', err)
    return ApiResponse.error(`Xóa thất bại: ${err.message}`, 500)
  }

  return ApiResponse.success({ url })
}
