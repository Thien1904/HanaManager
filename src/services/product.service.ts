// services/product.service.ts
//import { Product } from '@/types/database'
import { Product } from '@/types/product'
import { error } from 'console'
const STORAGE_URL = 'https://[your-project-id].supabase.co/storage/v1/object/public/products/'

export class ProductService {
  constructor(private supabase: any) {}

  // Helper để xử lý link ảnh
  private formatImageUrl(path: string | null) {
    if (!path) return null
    if (path.startsWith('http')) return path // Nếu đã là link tuyệt đối thì giữ nguyên
    return `${STORAGE_URL}${path}`
  }

  async getProducts(options: {
    categoryId?: number | string | null
    includeUnavailable?: boolean
  }) {
    let query = this.supabase
      .from('products')
      .select(
        `
      id, name, description, price, image_url, is_available,
      category_id, print_kitchen, print_bar, print_label,
      categories ( id, name ),
      product_variants ( id, name, price, is_default, is_active, sort_order )
    `,
      )
      .eq('is_deleted', false)
      .order('name')

    // Filter món
    if (!options.includeUnavailable) {
      query = query.eq('is_available', true)
    }

    // Ép kiểu number nếu categoryId tồn tại
    if (options.categoryId) {
      query = query.eq('category_id', Number(options.categoryId))
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((p: any) => ({
      ...p,
      // Xử lý link ảnh
      image_url: this.formatImageUrl(p.image_url),
      // Xử lý variants
      variants: (p.product_variants ?? [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
    }))
  }

  async createProduct(data: any) {
    const { error, data: result } = await this.supabase
      .from('products')
      .insert({
        name: data.name,
        price: data.price,
        description: data.description,
        category_id: data.category_id,
        image_url: data.image_url, // Lưu path thô vào DB
        is_available: data.is_available ?? true,
        print_kitchen: data.print_kitchen ?? true,
        print_bar: data.print_bar ?? false,
        print_label: data.print_label ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return result
  }

  async updateProduct(id: number, data: any) {
    const { error, data: result } = await this.supabase
      .from('products')
      .update({
        name: data.name,
        price: data.price,
        description: data.description,
        category_id: data.category_id,
        image_url: data.image_url,
        is_available: data.is_available,
        print_kitchen: data.print_kitchen,
        print_bar: data.print_bar,
        print_label: data.print_label,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return result
  }

  // CHỈ set is_deleted = true, KHÔNG xóa ảnh, KHÔNG set null image_url
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
  // Load các produc đã xóa để quản lý (nếu cần)
  async getDeletedProducts() {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        `
        id, name, price, description, category_id, image_url
      `,
      )
      .eq('is_deleted', true)
      .order('name')
    if (error) throw error
    return (data ?? []).map((p: any) => ({
      ...p,
      image_url: this.formatImageUrl(p.image_url),
    }))
  }
}
