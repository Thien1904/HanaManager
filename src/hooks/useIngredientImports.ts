// src/hooks/useIngredientPackages.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Ingredient_Package } from '@/types/database'

export function useIngredientPackages(ingredientId?: number) {
    const [packages, setPackages] = useState<Ingredient_Package[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!ingredientId) {
            setPackages([])
            return
        }
        setLoading(true)
        setError(null)
        try {
            // Mày sẽ cần tạo cái route này ở /api/ingredient-packages/route.ts
            // Truyền ingredientId qua query string
            const res = await window.fetch(`/api/ingredient-packages?ingredientId=${ingredientId}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Không thể tải quy cách')
            setPackages(json.data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [ingredientId])

    useEffect(() => { load() }, [load])

    return { packages, loading, error, refresh: load }
}