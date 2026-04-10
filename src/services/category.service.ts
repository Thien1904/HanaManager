import { apiFetch } from '@/lib/api'
import { Category } from '@/types/database'
export const createCategory = (name: string) => {
  return apiFetch<{ data: Category; error?: string }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
