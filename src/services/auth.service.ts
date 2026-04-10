import { apiFetch } from '@/lib/api'

// Type cho form login
export interface LoginPayload {
  username: string
  password: string
}

// Type response từ backend
export interface LoginResponse {
  success: boolean
  redirect: string
  user?: {
    id: number
    name: string
    role: string
  }
}

// 🔐 Login
export const login = (form: LoginPayload) => {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(form),
  })
}
