"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

interface RfqItem {
  productId: string
  description: string
  quantity: number
  unit: string
  targetPrice: string
  notes: string
}

export default function NewRfqPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<RfqItem[]>([{ productId: "", description: "", quantity: 1, unit: "units", targetPrice: "", notes: "" }])
  const [submitting, setSubmitting] = useState(false)

  const addItem = () => {
    setItems([...items, { productId: "", description: "", quantity: 1, unit: "units", targetPrice: "", notes: "" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof RfqItem, value: string | number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const handleSubmit = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    setSubmitting(true)
    try {
      const body = {
        title,
        description,
        notes,
        items: items.map((i) => ({
          productId: i.productId || undefined,
          description: i.description || undefined,
          quantity: Number(i.quantity),
          unit: i.unit,
          targetPrice: i.targetPrice ? Number(i.targetPrice) : undefined,
          notes: i.notes || undefined,
        })),
      }
      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/rfqs/${data.id}`)
      } else {
        alert(data.message || "Failed to create RFQ")
      }
    } catch (err) {
      alert("Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/rfqs" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6">
          <ArrowLeft size={16} /> Back to RFQs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New RFQ</h1>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg" placeholder="e.g., Q2 Electronics Procurement" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg" rows={3} placeholder="Describe your requirements..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg" placeholder="Any additional notes for vendors" />
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">Items</span>
              <button onClick={addItem} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                <Plus size={16} /> Add Item
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="sm:col-span-2">
                  <input type="text" placeholder="Product ID (optional)" value={item.productId} onChange={(e) => updateItem(index, "productId", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <input type="number" placeholder="Target ₹" value={item.targetPrice} onChange={(e) => updateItem(index, "targetPrice", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="sm:col-span-5">
                  <input type="text" placeholder="Notes" value={item.notes} onChange={(e) => updateItem(index, "notes", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="flex items-center justify-end">
                  <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !title || items.length === 0}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create RFQ"}
          </button>
        </div>
      </main>
    </div>
  )
}
