"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Package } from "lucide-react"
import Header from "@/components/layout/Header"

interface Product {
  id: string
  title: string
  sku: string | null
  unitPrice: number
  inventoryQuantity: number
  reservedQuantity: number
  moq: number
  status: string
  category?: { name: string }
}

export default function VendorProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoading(false) })
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-4"><ArrowLeft size={16} /> Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Products</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No products found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">MOQ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-gray-600">{p.sku || "-"}</td>
                    <td className="px-4 py-3">₹{Number(p.unitPrice).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">{p.inventoryQuantity - p.reservedQuantity} / {p.inventoryQuantity}</td>
                    <td className="px-4 py-3">{p.moq}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${p.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
