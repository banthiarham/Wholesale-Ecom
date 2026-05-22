import Link from "next/link"
import CategoryNav from "@/components/categories/CategoryNav"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <nav className="flex gap-4">
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
            <Link href="/cart" className="text-gray-600 hover:text-primary-600">Cart</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">B2B Wholesale Platform</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Bulk orders, tier pricing, RFQ, and loyalty — all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/products" className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
              Browse Products
            </Link>
            <Link href="/cart" className="px-6 py-3 bg-white text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">
              View Cart
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop by Category</h2>
          <CategoryNav />
        </div>
      </main>
    </div>
  )
}
