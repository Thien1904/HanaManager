// src/lib/auth-edge.ts
// Chỉ dùng jose — chạy được trên Edge Runtime (middleware)
// KHÔNG import 'next/headers' hoặc 'next/cookies' ở đây
import { jwtVerify } from 'jose'
import { UserRole } from '@/types/database'

export interface SessionPayload {
  userId: number
  username: string
  fullName: string | null
  role: UserRole
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
