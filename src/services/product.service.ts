// src/services/product.service.ts

import { Product } from '@/types/product'
import { PrinterCheck } from 'lucide-react'

const STORAGE_URL = 'https://[your-project-id].supabase.co/storage/v1/object/public/products/'

export class ProductService {
  constructor(private supabase: any) {}

  private mapProduct(p: any): Product {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),

      imageUrl: p.image_url,
      isAvailable: p.is_available ?? true,
      isDeleted: p.is_deleted ?? false,
      category: p.categories_id ?? null,

      printKitchen: p.print_kitchen ?? true,
      printBar: p.print_bar ?? false,
      printLabel: p.print_label ?? false,

      variants: (p.product_variants ?? [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
    }
  }

  private formatImageUrl(path: string | null) {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${STORAGE_URL}${path}`
  }

  async getProducts({ categoryId, includeUnavailable }: any) {
    let query = this.supabase
      .from('products')
      .select(
        `
      *,
      category:categories(id, name)
    `,
      )
      .eq('is_deleted', false)

    if (categoryId) {
      query = query.eq('category_id', Number(categoryId))
    }

    if (!includeUnavailable) {
      query = query.eq('is_available', true)
    }

    const { data, error } = await query
    if (error) throw error

    //map
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,

      imageUrl: p.image_url,
      isAvailable: p.is_available,
      printKitchen: p.print_kitchen,
      printBar: p.print_bar,
      printLabel: p.print_label,

      category: p.category
        ? {
            id: p.category.id,
            name: p.category.name,
          }
        : null,

      category_id: p.category_id,
    }))
  }

  async createProduct(data: any) {
    const { error, data: result } = await this.supabase
      .from('products')
      .insert({
        name: data.name,
        price: data.price,
        description: data.description,
        category_id: data.categoryId,
        image_url: data.imageUrl,
        is_available: data.isAvailable ?? true,
        print_kitchen: data.printKitchen ?? true,
        print_bar: data.printBar ?? false,
        print_label: data.printLabel ?? false,
      })
      .select()
      .single()

    if (error) throw error

    return this.mapProduct(result)
  }

  async updateProduct(id: number, data: any) {
    return this.supabase
      .from('products')
      .update({
        name: data.name,
        price: data.price,
        description: data.description,
        category_id: data.categoryId,
        image_url: data.imageUrl,
        is_available: data.isAvailable,
        print_kitchen: data.printKitchen,
        print_bar: data.printBar,
        print_label: data.printLabel,
      })
      .eq('id', id)
      .select(
        `
      *,
      categories (id, name),
      product_variants (*)
    `,
      )
      .maybeSingle()
  }
  // set is_Deleted=true, is_available =falses
  async deleteProduct(id: number) {
    const { error } = await this.supabase
      .from('products')
      .update({
        is_deleted: true,
        is_available: false,
      })
      .eq('id', id)

    if (error) throw error
  }
  async getDeletedProducts(): Promise<Product[]> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*, categories(id, name)')
        .eq('is_deleted', true)
        .order('id', { ascending: false })

      if (error) {
        // In thẳng lỗi từ Supabase ra console
        console.error('Lỗi Query Supabase:', error.message, error.details, error.hint)
        throw error
      }

      if (!data) return []

      return data.map((p: any) => {
        try {
          return this.mapProduct(p)
        } catch (mapError) {
          console.error('Lỗi mapping tại item:', p, mapError)
          throw mapError
        }
      })
    } catch (err) {
      console.error('Lỗi tổng quát trong Service:', err)
      throw err
    }
  }
  async restoreProduct(id: number) {
    const { error } = await this.supabase
      .from('products')
      .update({ is_deleted: false, is_available: true }) // Khôi phục và cho phép bán
      .eq('id', id)

    if (error) throw error
  }
}
