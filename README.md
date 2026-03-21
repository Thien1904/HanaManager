# 🍽️ Restaurant POS

Hệ thống quản lý nhà hàng full-stack: POS, Kitchen, HR, AI Chat.

## Tech Stack
- **Frontend + Backend:** Next.js 14 (App Router)
- **Database:** PostgreSQL (Supabase)
- **Auth:** JWT custom (bcryptjs + jose)
- **AI:** Claude API (Anthropic)
- **Styling:** Tailwind CSS
- **Deploy:** Vercel

## Cấu trúc thư mục
```
src/
├── app/
│   ├── (auth)/login/        ← Trang đăng nhập
│   ├── (dashboard)/
│   │   ├── admin/           ← Chỉ admin
│   │   ├── waiter/          ← Waiter + admin
│   │   ├── chef/            ← Chef + admin
│   │   └── chat/            ← Tất cả roles
│   └── api/                 ← API Routes (backend)
├── components/              ← UI components
├── lib/                     ← Supabase client, Auth
├── types/                   ← TypeScript types
├── hooks/                   ← Custom React hooks
└── utils/                   ← Helper functions
```

## Setup

### 1. Clone và cài dependencies
```bash
git clone <repo-url>
cd restaurant-pos
npm install
```

### 2. Tạo file .env.local
```bash
cp .env.example .env.local
```
Điền đầy đủ các giá trị trong `.env.local`

### 3. Setup Supabase
1. Tạo project tại [supabase.com](https://supabase.com)
2. Vào **SQL Editor** → chạy file `restaurant_schema_v2.4_final.sql`
3. Copy **Project URL** và **anon key** vào `.env.local`

### 4. Chạy development
```bash
npm run dev
```
Mở [http://localhost:3000](http://localhost:3000)

## Tài khoản mặc định
Sau khi chạy schema, tạo user admin đầu tiên qua SQL:
```sql
INSERT INTO users (username, password_hash, full_name, role)
VALUES ('admin', '<bcrypt_hash>', 'Chủ Quán', 'admin');
```

## Roles
| Role | Quyền truy cập |
|------|---------------|
| `admin` | Tất cả tính năng |
| `waiter` | Bàn, Order, Chat |
| `chef` | Màn hình bếp, Chat |
