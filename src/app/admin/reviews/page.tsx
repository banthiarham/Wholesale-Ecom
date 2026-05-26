"use client"

import { useEffect, useState } from "react"
import { Search, Trash2, Star } from "lucide-react"

interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  isVerified: boolean
  createdAt: string
  user: { id: string; firstName: string; lastName: string }
  product: { id: string; title: string }
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [filtered, setFiltered] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [ratingFilter, setRatingFilter] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadReviews() }, [token])
  useEffect(() => {
    let result = reviews
    if (search) { const q = search.toLowerCase(); result = result.filter((r) => r.product?.title?.toLowerCase().includes(q) || r.user?.firstName?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q)) }
    if (ratingFilter) result = result.filter((r) => String(r.rating) === ratingFilter)
    setFiltered(result)
  }, [reviews, search, ratingFilter])

  const loadReviews = async () => {
    setLoading(true)
    try { const res = await fetch("/api/reviews", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setReviews(Array.isArray(data) ? data : data.reviews ?? []); setFiltered(Array.isArray(data) ? data : data.reviews ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/reviews/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search by product, user, or title..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Ratings</option><option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option></select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><Star size={48} className="text-gray-300 mx-auto mb-4" /><p className="text-gray-600">No reviews found.</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={14} className={s <= r.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"} />)}</div>
                    {r.isVerified && <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-semibold rounded-full">VERIFIED</span>}
                  </div>
                  {r.title && <p className="font-medium text-gray-900 mb-1">{r.title}</p>}
                  <p className="text-sm text-gray-600 line-clamp-2">{r.body || "No comment"}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{r.user?.firstName} {r.user?.lastName}</span>
                    <span>on {r.product?.title}</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 shrink-0" title="Delete review"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}