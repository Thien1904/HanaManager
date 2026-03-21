// src/lib/auth.ts
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { verifyToken, SessionPayload } from '@/lib/auth-edge'
import { UserRole } from '@/types/database'

export type { SessionPayload }

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'pos_session'
const COOKIE_MAX_AGE = 60 * 60 * 8  // 8 tiếng

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)
}

// ✅ Next.js 16: cookies() phải await
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export function hasRole(session: SessionPayload | null, roles: UserRole[]): boolean {
  if (!session) return false
  return roles.includes(session.role)
}

export function isAdmin(session: SessionPayload | null): boolean {
  return hasRole(session, ['admin'])
}
