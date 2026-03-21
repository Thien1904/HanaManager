// ================================================
// src/types/database.ts
// Type definitions khớp với schema PostgreSQL
// ================================================

// --- ENUMS ---
export type UserRole = 'admin' | 'waiter' | 'chef'
export type TableStatus = 'available' | 'occupied' | 'reserved'
export type OrderStatus = 'pending' | 'sent_to_kitchen' | 'preparing' | 'served' | 'paid' | 'cancelled'
export type PurchaseStatus = 'pending' | 'completed' | 'cancelled'
export type KitchenTicketStatus = 'sent' | 'acknowledged' | 'completed' | 'cancelled'
export type PrintStatus = 'pending' | 'printing' | 'printed' | 'failed' | 'cancelled'
export type PrinterType = 'kitchen' | 'cashier' | 'bar'
export type PayrollStatus = 'draft' | 'confirmed' | 'paid'
export type BonusType = 'performance' | 'attendance' | 'holiday' | 'other'
export type DeductionType = 'late' | 'absent' | 'violation' | 'other'

// --- TABLES ---
export interface User {
  id: number
  username: string
  password_hash: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface EmployeeType {
  id: number
  name: string
  description: string | null
  default_hourly_rate: number
  overtime_rate: number | null
  weekend_rate: number | null
  max_hours_per_week: number | null
  is_active: boolean
  created_at: string
}

export interface EmployeeProfile {
  id: number
  user_id: number
  employee_type_id: number | null
  custom_hourly_rate: number | null
  custom_overtime_rate: number | null
  custom_weekend_rate: number | null
  hire_date: string | null
  id_card: string | null
  bank_account: string | null
  bank_name: string | null
  address: string | null
  emergency_contact: string | null
  is_active: boolean
  note: string | null
  created_at: string
}

export interface ShiftTemplate {
  id: number
  name: string
  start_time: string   // "07:00:00"
  end_time: string     // "12:00:00"
  duration_hours: number | null
  is_active: boolean
}

export interface WorkSchedule {
  id: number
  user_id: number
  shift_template_id: number
  scheduled_date: string   // "2025-03-15"
  week_number: number | null
  month: number | null
  year: number | null
  source: 'manual' | 'approved'
  registration_id: number | null
  note: string | null
  created_by: number | null
  created_at: string
}

export interface Attendance {
  id: number
  work_schedule_id: number | null
  user_id: number
  check_in: string | null
  check_out: string | null
  actual_hours: number | null
  is_late: boolean
  late_minutes: number
  note: string | null
  confirmed_by: number | null
  status: 'present' | 'absent' | 'half_day' | 'leave'
}

export interface Payroll {
  id: number
  user_id: number
  month: number
  year: number
  total_scheduled_shifts: number
  total_worked_shifts: number
  total_hours: number
  overtime_hours: number
  base_salary: number
  overtime_pay: number
  bonus: number
  deductions: number
  net_salary: number
  status: PayrollStatus
  confirmed_by: number | null
  paid_at: string | null
  note: string | null
  created_at: string
}

export interface Category {
  id: number
  name: string
}

export interface Product {
  id: number
  category_id: number | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  is_deleted: boolean
}

export interface Table {
  id: number
  table_number: string
  status: TableStatus
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  points: number
  created_at: string
}

export interface Discount {
  id: number
  code: string | null
  type: 'percent' | 'fixed'
  value: number
  min_order_value: number
  expires_at: string | null
  is_active: boolean
}

export interface Order {
  id: number
  table_id: number | null
  user_id: number | null
  customer_id: number | null
  discount_id: number | null
  total_price: number
  discount_amount: number
  status: OrderStatus
  payment_status: 'unpaid' | 'paid'
  note: string | null
  created_at: string
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  subtotal: number
  notes: string | null
}

export interface Payment {
  id: number
  order_id: number
  method: 'cash' | 'card' | 'momo' | 'vnpay' | 'banking'
  amount: number
  paid_at: string
}

export interface KitchenTicket {
  id: number
  order_id: number
  table_id: number | null
  sent_by: number | null
  items_snapshot: KitchenItem[]  // JSONB parsed
  note: string | null
  acknowledged_by: number | null
  acknowledged_at: string | null
  completed_by: number | null
  completed_at: string | null
  status: KitchenTicketStatus
  sent_at: string
}

export interface KitchenItem {
  name: string
  quantity: number
  notes: string
}

export interface PrintQueue {
  id: number
  ticket_id: number | null
  order_id: number
  printer_type: PrinterType
  printer_id: string | null
  content: string
  content_json: object | null
  status: PrintStatus
  priority: number
  retry_count: number
  max_retries: number
  error_message: string | null
  created_by: number | null
  created_at: string
  printed_at: string | null
}

export interface Ingredient {
  id: number
  name: string
  unit: string
  stock_quantity: number
  min_stock_level: number
  updated_at: string
}

export interface AiConversation {
  id: number
  user_id: number
  title: string | null
  mode: 'staff' | 'owner'
  started_at: string
  ended_at: string | null
}

export interface AiMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  data_source: 'knowledge_base' | 'database' | 'combined' | null
  tokens_used: number | null
  created_at: string
}

// --- JOIN TYPES (dùng khi query có JOIN) ---
export interface OrderWithDetails extends Order {
  table: Table | null
  user: Pick<User, 'id' | 'full_name'> | null
  customer: Pick<Customer, 'id' | 'name' | 'phone'> | null
  order_items: (OrderItem & { product: Product })[]
}

export interface UserWithProfile extends User {
  employee_profile: (EmployeeProfile & { employee_type: EmployeeType }) | null
}

export interface WorkScheduleWithDetails extends WorkSchedule {
  user: Pick<User, 'id' | 'full_name'>
  shift_template: ShiftTemplate
}
