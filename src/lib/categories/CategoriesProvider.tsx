"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export interface CategoryNode {
  id: string
  name: string
  handle: string
  image?: string | null
  description?: string | null
  _count?: { products: number }
  children?: CategoryNode[]
}

interface CategoriesContextType {
  /** Root categories, each with its own `children` tree — same shape /api/categories returns. */
  categories: CategoryNode[]
  loaded: boolean
  error: boolean
}

const CategoriesContext = createContext<CategoriesContextType>({
  categories: [],
  loaded: false,
  error: false,
})

/**
 * Fetches /api/categories exactly once for the whole app (previously each of
 * the homepage, CategoryIconStrip, ShopByCategoryGrid, /categories, and
 * /products independently fetched the same public endpoint on their own
 * mount — three concurrent requests on the homepage alone).
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/categories")
      .then(async (res) => {
        if (!res.ok) { setError(true); return }
        const data = await res.json()
        setCategories(Array.isArray(data.categories) ? data.categories : [])
      })
      .catch(() => setError(true))
      .finally(() => setLoaded(true))
  }, [])

  return (
    <CategoriesContext.Provider value={{ categories, loaded, error }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}

/** Depth-first flatten of the category tree — for consumers that need a flat
 *  list (e.g. a filter dropdown) rather than the root/children shape. */
export function flattenCategories(categories: CategoryNode[]): CategoryNode[] {
  const flat: CategoryNode[] = []
  const walk = (arr: CategoryNode[]) => {
    for (const c of arr || []) {
      flat.push(c)
      if (c.children?.length) walk(c.children)
    }
  }
  walk(categories)
  return flat
}
