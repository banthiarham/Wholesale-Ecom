"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import OrderEditor from "@/components/admin/OrderEditor"
import { SkeletonTable } from "@/components/admin/Skeleton"

export default function AdminEditOrderPage() {
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrder(d.order || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <SkeletonTable />
  if (!order) return <div className="text-sm text-gray-500">Order not found. <Link href="/admin/orders" className="text-primary-600">Back to orders</Link></div>
  if (order.status === "CANCELLED") return <div className="text-sm text-gray-500">A cancelled order cannot be edited. <Link href={`/admin/orders/${order.id}`} className="text-primary-600">Back to order</Link></div>
  return <OrderEditor order={order} />
}
