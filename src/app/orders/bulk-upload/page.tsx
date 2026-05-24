"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, FileText } from "lucide-react"

export default function BulkUploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [shippingAddress, setShippingAddress] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [notes, setNotes] = useState("")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleUpload = async () => {
    if (!file) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("shippingAddress", JSON.stringify(shippingAddress))
    formData.append("notes", notes)

    const res = await fetch("/api/orders/bulk-csv", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    setResult(data)
    setUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to Orders</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bulk CSV Order Upload</h1>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">CSV Format</p>
            <p className="text-xs text-blue-700">Columns: sku, quantity, notes (optional). One row per product.</p>
            <p className="text-xs text-blue-700 mt-1">Example: WEP-001, 50, Urgent delivery needed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Street" value={shippingAddress.street} onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="text" placeholder="City" value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="text" placeholder="State" value={shippingAddress.state} onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="text" placeholder="ZIP" value={shippingAddress.zip} onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Order notes" />
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload size={32} className="text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{file ? file.name : "Click to select CSV file"}</p>
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !shippingAddress.street || !shippingAddress.city}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload & Create Order"}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.errors ? "bg-yellow-50 border border-yellow-100" : "bg-green-50 border border-green-100"}`}>
              {result.order && (
                <div className="mb-3">
                  <p className="font-medium text-green-800">Order created successfully!</p>
                  <Link href={`/orders/${result.order.id}`} className="text-sm text-primary-600 hover:underline">View Order →</Link>
                </div>
              )}
              {result.errors && (
                <div>
                  <p className="font-medium text-yellow-800 mb-1">Warnings:</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
