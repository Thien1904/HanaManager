// src/components/admin/ProductFormModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  category_id: number;
};

type Category = { id: number; name: string };

interface Props {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: product?.name ?? "",
    category_id: product?.category_id ?? categories[0]?.id ?? 0,
    price: product?.price ?? 0,
    description: product?.description ?? "",
    image_url: product?.image_url ?? "",
    is_available: product?.is_available ?? true,
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Ảnh tối đa 2MB"); return; }
    // Xóa anh cũ nếu có
    if (form.image_url) {
      await fetch("/api/upload",
         { method: "DELETE",
             headers: { "Content-Type": "application/json" 

             },
              body: JSON.stringify({ url: form.image_url }) 
            }
        );
    
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

   if (data.data?.url) setForm((f) => ({ ...f, image_url: data.data.url }));
    else setError("Upload ảnh thất bại");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (!form.name.trim()) { setError("Tên món không được trống"); return; }
    if (!form.category_id) { setError("Chọn danh mục"); return; }
    if (form.price <= 0) { setError("Giá phải lớn hơn 0"); return; }

    setSaving(true);
    const payload = isEdit ? { id: product!.id, ...form } : form;
    const res = await fetch("/api/products", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) setError(data.error ?? "Có lỗi xảy ra");
    else onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? "Sửa món" : "Thêm món mới"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Upload ảnh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh món</label>
            <div
              className="relative border-2 border-dashed border-gray-300 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:border-orange-400 transition overflow-hidden"
              onClick={() => fileRef.current?.click()}
            >
              {form.image_url ? (
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-400 text-sm">
                  <div className="text-3xl mb-1">📷</div>
                  <div>Click để upload ảnh</div>
                  <div className="text-xs mt-1">JPG, PNG — tối đa 2MB</div>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm text-gray-500">
                  Đang upload...
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {form.image_url && (
              <button
                type="button"
                onClick={ async()=>{
                  if(!confirm("Xóa ảnh này?")) return;
                  setUploading(true);
                  await fetch("/api/upload", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: form.image_url }),
                  });
                  setForm((f) => ({ ...f, image_url: "" }));
                  setUploading(false);
                }}
                className="mt-1 text-xs text-red-500 hover:underline"
              >
                Xóa ảnh
              </button>
            )}
          </div>

          {/* Tên món */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên món *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="VD: Phở bò đặc biệt"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Danh mục + Giá */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá (đ) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                min={0}
                step={1000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Mô tả ngắn về món..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {/* Toggle available */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.is_available ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.is_available ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              {form.is_available ? "Đang bán" : "Tạm hết"}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm món"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}