"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Package, ImagePlus, X, ImageIcon } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

interface BulkResult {
  created: number
  updated: number
  errors: string[]
  imageErrors: string[]
  imagesDownloaded: number
  imagesUploaded: number
}

function skuFromFilename(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, "") // strip extension
  const match = name.match(/^(.+?)_(\d+)$/) // strip _N suffix
  return match ? match[1] : name
}

export default function AdminBulkProductUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)

  // Image files state: Map<SKU, File[]>
  const [imageFiles, setImageFiles] = useState<Map<string, File[]>>(new Map())
  const [imagePreviews, setImagePreviews] = useState<Map<string, string[]>>(new Map())
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const headers = ["sku", "title", "unitPrice", "moq", "inventoryQuantity", "description", "status", "compareAtPrice", "vendorName", "categoryId", "tags", "images"]
    const exampleRow = ["WEP-NEW001", "New Product Name", "999", "5", "200", "Product description here", "PUBLISHED", "1299", "Vendor Name", "", "tag1, tag2", "https://example.com/img1.jpg, https://example.com/img2.jpg"]
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
    ws["!cols"] = [
      { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 18 },
      { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 20 }, { wch: 50 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Products")
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    saveAs(blob, "bulk_products_template.xlsx")
  }

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    )
    addImageFiles(files)
  }, [])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    )
    addImageFiles(files)
    if (e.target) e.target.value = ""
  }, [])

  const addImageFiles = (files: File[]) => {
    setImageFiles((prev) => {
      const next = new Map(prev)
      setImagePreviews((prevP) => {
        const nextP = new Map(prevP)
        for (const f of files) {
          const sku = skuFromFilename(f.name)
          const existing = next.get(sku) || []
          if (!next.has(sku)) next.set(sku, [])
          next.get(sku)!.push(f)
          const existingP = nextP.get(sku) || []
          if (!nextP.has(sku)) nextP.set(sku, [])
          nextP.get(sku)!.push(URL.createObjectURL(f))
        }
        return nextP
      })
      // We need to do this inside setImageFiles to get proper accumulation
      for (const f of files) {
        const sku = skuFromFilename(f.name)
        const existing = next.get(sku) || []
        if (!next.has(sku)) next.set(sku, [])
        next.get(sku)!.push(f)
      }
      return next
    })
  }

  const removeImage = (sku: string, index: number) => {
    setImageFiles((prev) => {
      const next = new Map(prev)
      const files = next.get(sku)
      if (files) {
        files.splice(index, 1)
        if (files.length === 0) next.delete(sku)
        else next.set(sku, [...files])
      }
      return next
    })
    setImagePreviews((prev) => {
      const next = new Map(prev)
      const previews = next.get(sku)
      if (previews) {
        URL.revokeObjectURL(previews[index])
        previews.splice(index, 1)
        if (previews.length === 0) next.delete(sku)
        else next.set(sku, [...previews])
      }
      return next
    })
  }

  const totalImages = Array.from(imageFiles.values()).reduce((sum, f) => sum + f.length, 0)

  const handleUpload = async () => {
    if (!file) return
    const token = localStorage.getItem("token")
    if (!token) return

    setUploading(true)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    // Build image mapping: originalFilename → SKU
    const mapping: Record<string, string> = {}
    imageFiles.forEach((files, sku) => {
      files.forEach((f) => {
        mapping[f.name] = sku
        formData.append("images", f)
      })
    })
    if (Object.keys(mapping).length > 0) {
      formData.append("imageMapping", JSON.stringify(mapping))
    }

    try {
      const res = await fetch("/api/products/bulk-upload-excel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setResult({
          created: data.created || 0,
          updated: data.updated || 0,
          errors: data.errors || [],
          imageErrors: data.imageErrors || [],
          imagesDownloaded: data.imagesDownloaded || 0,
          imagesUploaded: data.imagesUploaded || 0,
        })
      } else {
        setResult({ created: 0, updated: 0, errors: [data.message || "Upload failed"], imageErrors: [], imagesDownloaded: 0, imagesUploaded: 0 })
      }
    } catch (e) {
      setResult({ created: 0, updated: 0, errors: ["Network error. Please try again."], imageErrors: [], imagesDownloaded: 0, imagesUploaded: 0 })
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-800">
          <div className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-blue-700 text-xs">Get the Excel template with all columns including images</p>
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
              <p className="font-medium">Add Images</p>
              <p className="text-blue-700 text-xs">Paste URLs in the images column, or drop local files named by SKU below</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-blue-600">4.</span>
            <div>
              <p className="font-medium">Upload & Review</p>
              <p className="text-blue-700 text-xs">See results — products created, updated, and images processed</p>
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
                { col: "images", req: "No", desc: "Comma-separated image URLs — downloaded and stored automatically", ex: "https://img.host/a.jpg, https://img.host/b.jpg" },
              ].map((r) => (
                <tr key={r.col} className={`hover:bg-gray-50 ${r.col === "images" ? "bg-amber-50/50" : ""}`}>
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Excel File */}
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="product-excel-upload" />
          <label htmlFor="product-excel-upload" className="cursor-pointer">
            <Upload size={40} className="text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">{file ? file.name : "Click to select Excel file (.xlsx)"}</p>
            <p className="text-xs text-gray-400 mt-1">SKU column is required — matching SKUs will update existing products</p>
          </label>
        </div>

        {/* Image Drag & Drop Zone */}
        <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <ImagePlus size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-900">Product Images (Optional)</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Two ways to add images: (1) paste URLs in the <span className="font-mono font-medium text-amber-700">images</span> column of the Excel, or (2) drop local image files below named by SKU.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImageDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${dragOver ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageSelect} className="hidden" id="image-files-upload" />
            <label htmlFor="image-files-upload" className="cursor-pointer">
              <ImageIcon size={28} className="text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Drop image files here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Name files as <span className="font-mono">SKU.jpg</span> or <span className="font-mono">SKU_1.jpg</span> — matched to products by SKU</p>
            </label>
          </div>

          {/* Show dropped images grouped by SKU */}
          {imageFiles.size > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700">{totalImages} image{totalImages !== 1 ? "s" : ""} for {imageFiles.size} SKU{imageFiles.size !== 1 ? "s" : ""}</p>
                <button
                  onClick={() => {
                    setImageFiles(new Map())
                    setImagePreviews(new Map())
                  }}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
                  Clear all
                </button>
              </div>
              {Array.from(imageFiles.entries()).map(([sku, files]) => (
                <div key={sku} className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-gray-800 mb-2">SKU: <span className="font-mono text-primary-600">{sku}</span> <span className="text-gray-400 font-normal">({files.length} image{files.length !== 1 ? "s" : ""})</span></p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, idx) => (
                      <div key={idx} className="relative group">
                        <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
                          <img src={imagePreviews.get(sku)?.[idx] || ""} alt={f.name} className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => removeImage(sku, idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                        >
                          <X size={10} />
                        </button>
                        <p className="text-[10px] text-gray-400 truncate w-16 mt-0.5">{f.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium"
        >
          <Package size={18} />
          {uploading ? "Uploading & Processing..." : "Upload & Process Products"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Upload Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
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
            {(result.imagesDownloaded > 0 || result.imagesUploaded > 0) && (
              <>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <ImagePlus size={20} className="text-purple-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-700">{result.imagesDownloaded}</p>
                  <p className="text-xs text-purple-600">URLs Downloaded</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <ImageIcon size={20} className="text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{result.imagesUploaded}</p>
                  <p className="text-xs text-amber-600">Files Uploaded</p>
                </div>
              </>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} className="text-red-500" />
                <p className="text-sm font-medium text-red-800">Row Errors ({result.errors.length})</p>
              </div>
              <ul className="text-sm text-red-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {result.imageErrors && result.imageErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-sm font-medium text-amber-800">Image Warnings ({result.imageErrors.length})</p>
              </div>
              <ul className="text-sm text-amber-700 list-disc list-inside max-h-40 overflow-y-auto">
                {result.imageErrors.map((e, i) => <li key={i}>{e}</li>)}
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