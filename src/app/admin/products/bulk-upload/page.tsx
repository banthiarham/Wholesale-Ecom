"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Package } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

interface BulkResult {
  created: number
  updated: number
  errors: string[]
}

export default function AdminBulkProductUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)

  const downloadTemplate = () => {
    const headers = ["sku", "title", "unitPrice", "moq", "inventoryQuantity", "description", "status", "compareAtPrice", "vendorName", "categoryId", "tags"]
    const exampleRow = ["WEP-NEW001", "New Product Name", "999", "5", "200", "Product description here", "PUBLISHED", "1299", "Vendor Name", "", "tag1, tag2"]
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
    ws["!cols"] = [
      { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 18 },
      { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 20 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Products")
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    saveAs(blob, "bulk_products_template.xlsx")
  }

  const handleUpload = async () => {
    if (!file) return
    const token = localStorage.getItem("token")
    if (!token) return

    setUploading(true)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/products/bulk-upload-excel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setResult({ created: 0, updated: 0, errors: [data.message || "Upload failed"] })
      }
    } catch (e) {
      setResult({ created: 0, updated: 0, errors: ["Network error. Please try again."] })
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/products" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-2"><ArrowLeft size={14} /> Back to Products</Link>
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="text-primary-600" />
            <h1 className="text-xl font-semibold text-gray-900">Bulk Product Upload</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Upload Excel to create new products or update existing ones by SKU</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">How it works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-blue-700 text-xs">Get the Excel template with all columns</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            <div>
              <p className="font-medium">Fill Product Data</p>
              <p className="text-blue-700 text-xs">SKU is the key — existing SKUs get updated, new SKUs create products</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            <div>
              <p className="font-medium">Upload & Review</p>
              <p className="text-blue-700 text-xs">See how many were created vs updated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Template Download */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Excel Columns Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-600">Column</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Required</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { col: "sku", req: "Yes", desc: "Unique product SKU — used to match existing products", ex: "WEP-001" },
                { col: "title", req: "Yes", desc: "Product name", ex: "Power Bank 20000mAh" },
                { col: "unitPrice", req: "Yes", desc: "Selling price", ex: "999" },
                { col: "moq", req: "No", desc: "Minimum order quantity (default: 1)", ex: "5" },
                { col: "inventoryQuantity", req: "No", desc: "Current stock (default: 0)", ex: "200" },
                { col: "description", req: "No", desc: "Product description", ex: "High capacity..." },
                { col: "status", req: "No", desc: "DRAFT, PUBLISHED, or ARCHIVED (default: PUBLISHED)", ex: "PUBLISHED" },
                { col: "compareAtPrice", req: "No", desc: "Original/compare price", ex: "1299" },
                { col: "vendorName", req: "No", desc: "Vendor/supplier name", ex: "ABC Supplies" },
                { col: "categoryId", req: "No", desc: "Category UUID", ex: "" },
                { col: "tags", req: "No", desc: "Comma-separated tags", ex: "electronics, battery" },
              ].map((r) => (
                <tr key={r.col} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">{r.col}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.req === "Yes" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{r.req}</span></td>
                  <td className="px-3 py-2 text-gray-600">{r.desc}</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{r.ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={downloadTemplate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
          <Download size={16} /> Download Excel Template
        </button>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="product-excel-upload" />
          <label htmlFor="product-excel-upload" className="cursor-pointer">
            <Upload size={40} className="text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">{file ? file.name : "Click to select Excel file (.xlsx)"}</p>
            <p className="text-xs text-gray-400 mt-1">SKU column is required — matching SKUs will update existing products</p>
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium"
        >
          <Package size={18} />
          {uploading ? "Uploading..." : "Upload & Process Products"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Upload Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <CheckCircle size={20} className="text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600">Created</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <FileSpreadsheet size={20} className="text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
              <p className="text-xs text-blue-600">Updated</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <XCircle size={20} className="text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-yellow-600" />
                <p className="text-sm font-medium text-yellow-800">Errors ({result.errors.length})</p>
              </div>
              <ul className="text-sm text-yellow-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {(result.created > 0 || result.updated > 0) && (
            <Link href="/admin/products" className="inline-flex items-center gap-2 mt-4 text-sm text-primary-600 hover:underline">
              View All Products →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}