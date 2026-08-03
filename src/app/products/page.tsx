"use client"

import { Suspense } from "react"
import ProductsPageInner from "./ProductsPageInner"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="section-container py-8"><ProductGridSkeleton count={12} /></div>}>
      <ProductsPageInner />
    </Suspense>
  )
}
