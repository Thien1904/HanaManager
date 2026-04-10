import { apiFetch } from '@/lib/api'

export interface Category {
  id: number
  name: string
}

// GET all
export const getCategories = () => {
  return apiFetch<{ data: Category[] }>('/categories')
}

// CREATE
export const createCategory = (name: string) => {
  return apiFetch<{ data: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

// UPDATE
export const updateCategory = (id: number, name: string) => {
  return apiFetch<{ data: Category }>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

// DELETE
export const deleteCategory = (id: number) => {
  return apiFetch<{ success: boolean }>(`/categories/${id}`, {
    method: 'DELETE',
  })
}
