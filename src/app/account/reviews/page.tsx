"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, Trash2, MessageSquare, Package } from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import { EmptyState } from "@/components/ui/EmptyState"

interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  createdAt: string
  product: { id: string; title: string; handle: string; thumbnail: string | null }
}

export default function MyReviewsPage() {
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { showToast } = useToast()

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) { router.push("/login"); return }
    loadReviews()
  }, [router])

  const loadReviews = async () => {
    try {
      // Fetch all reviews and filter client-side by user
      const res = await fetch("/api/reviews", { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews || [])
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id))
      } else {
        showToast("error", "Could not delete review")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (reviews.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <EmptyState
        icon={MessageSquare}
        title="No reviews yet"
        description="Share your experience by reviewing products you've purchased."
        action={{ label: "View My Orders", href: "/orders" }}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""} written</p>
        </div>

        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="card-base-static p-5">
              <div className="flex items-start gap-4">
                <Link href={`/products/${review.product.handle}`} className="shrink-0">
                  <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
                    {review.product.thumbnail ? (
                      <img src={review.product.thumbnail} alt={review.product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-400" /></div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${review.product.handle}`} className="font-semibold text-gray-900 hover:text-primary-600 transition">
                    {review.product.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex text-yellow-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-gray-300"} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  {review.title && <h4 className="font-medium text-gray-900 mt-2">{review.title}</h4>}
                  {review.body && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{review.body}</p>}
                </div>
                <button
                  onClick={() => handleDelete(review.id)}
                  disabled={deletingId === review.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0"
                  title="Delete review"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}