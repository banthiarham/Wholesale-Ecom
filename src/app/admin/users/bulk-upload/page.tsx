"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

interface PreviewRow {
  Name?: string
  Username?: string
  "Last Active"?: string
  "Sign Up"?: string
  Email?: string
  Orders?: number | string
  "Total Spend"?: number | string
  AOV?: number | string
  "Country / Region"?: string
  City?: string
  Region?: string
  "Postal Code"?: string
}

interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

export default function BulkUserUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [fileError, setFileError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const downloadTemplate = () => {
    const headers = ["Name", "Username", "Last Active", "Sign Up", "Email", "Orders", "Total Spend", "AOV", "Country / Region", "City", "Region", "Postal Code"]
    const sample = ["Amit Sharma", "amit.sharma", "2026-08-17T08:13:10", "2026-08-17T13:43:08", "buyer@example.com", 0, 0, 0, "IN", "Delhi", "DL", "110001"]
    const sheet = XLSX.utils.aoa_to_sheet([headers, sample])
    sheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 3, 18) }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Users")
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bulk_users_template.xlsx")
  }

  const selectFile = async (selected: File | null) => {
    setFile(null)
    setPreview([])
    setRowCount(0)
    setResult(null)
    setFileError("")
    if (!selected) return

    if (!/\.(csv|xlsx|xls)$/i.test(selected.name)) {
      setFileError("Choose a CSV, XLSX, or XLS file")
      return
    }

    try {
      const workbook = XLSX.read(await selected.arrayBuffer(), { type: "array" })
      const rows = XLSX.utils.sheet_to_json<PreviewRow>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" })
      if (!rows.length) throw new Error("The selected file has no user rows")
      if (rows.length > 1000) throw new Error("A maximum of 1000 users can be imported at once")
      setFile(selected)
      setRowCount(rows.length)
      setPreview(rows.slice(0, 10))
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Unable to read this file")
    }
  }

  const upload = async () => {
    if (!file) return
    const token = localStorage.getItem("token")
    if (!token) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      const response = await fetch(`${apiBase}/api/v1/users/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "Import failed")
      setResult({ created: data.created || 0, skipped: data.skipped || 0, errors: data.errors || [] })
    } catch (error) {
      setResult({ created: 0, skipped: rowCount, errors: [error instanceof Error ? error.message : "Import failed"] })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"><ArrowLeft size={14} /> Back to Users</Link>
        <div className="flex items-center gap-3"><FileSpreadsheet className="text-primary-600" size={24} /><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bulk User Upload</h1></div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create up to 1,000 users from CSV or Excel. Existing email addresses are safely skipped.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200 md:grid-cols-3">
        <div><strong>1. Download template</strong><p className="mt-1 text-xs opacity-80">Keep the column headings unchanged.</p></div>
        <div><strong>2. Add customer details</strong><p className="mt-1 text-xs opacity-80">Name and Email are required. Keep the reference headers unchanged.</p></div>
        <div><strong>3. Review and import</strong><p className="mt-1 text-xs opacity-80">Invalid and duplicate rows are reported without stopping valid rows.</p></div>
      </div>

      <div className="admin-card-static p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">Customer import template</h2><p className="text-sm text-gray-500 dark:text-gray-400">Matches the WooCommerce customer report export format.</p></div>
          <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"><Download size={16} /> Download Excel Template</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {['Name*','Username','Last Active','Sign Up','Email*','Orders','Total Spend','AOV','Country / Region','City','Region','Postal Code'].map((column) => <span key={column} className="rounded bg-gray-100 px-2 py-1 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">{column}</span>)}
        </div>
      </div>

      <div className="admin-card-static space-y-5 p-6">
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
          <input id="user-bulk-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
          <label htmlFor="user-bulk-file" className="cursor-pointer"><Upload className="mx-auto mb-3 text-gray-400" size={40} /><p className="text-sm text-gray-700 dark:text-gray-300">{file ? file.name : "Click to select CSV or Excel file"}</p><p className="mt-1 text-xs text-gray-400">Maximum 5 MB and 1,000 rows</p></label>
        </div>
        {fileError && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"><AlertTriangle size={16} />{fileError}</div>}

        {preview.length > 0 && <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</h3><span className="text-xs text-gray-500">{rowCount} rows detected</span></div><div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['Name','Username','Last Active','Sign Up','Email','Orders','Total Spend','AOV','Country / Region','City','Region','Postal Code'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{preview.map((row, index) => <tr key={index}><td className="whitespace-nowrap px-3 py-2">{row.Name}</td><td className="whitespace-nowrap px-3 py-2">{row.Username}</td><td className="whitespace-nowrap px-3 py-2">{row["Last Active"]}</td><td className="whitespace-nowrap px-3 py-2">{row["Sign Up"]}</td><td className="whitespace-nowrap px-3 py-2">{row.Email}</td><td className="px-3 py-2">{row.Orders}</td><td className="px-3 py-2">{row["Total Spend"]}</td><td className="px-3 py-2">{row.AOV}</td><td className="px-3 py-2">{row["Country / Region"]}</td><td className="px-3 py-2">{row.City}</td><td className="px-3 py-2">{row.Region}</td><td className="px-3 py-2">{row["Postal Code"]}</td></tr>)}</tbody></table></div>{rowCount > 10 && <p className="mt-2 text-xs text-gray-400">Showing the first 10 rows.</p>}</div>}

        <button onClick={upload} disabled={!file || uploading} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16} />{uploading ? "Importing users..." : `Import ${rowCount || ''} Users`}</button>
      </div>

      {result && <div className="admin-card-static p-5"><div className="flex flex-wrap gap-6"><div className="flex items-center gap-2 text-green-700 dark:text-green-400"><CheckCircle size={20} /><strong>{result.created} created</strong></div><div className="flex items-center gap-2 text-amber-700 dark:text-amber-400"><AlertTriangle size={20} /><strong>{result.skipped} skipped</strong></div></div>{result.errors.length > 0 && <div className="mt-4 max-h-64 overflow-y-auto rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300"><p className="mb-2 font-semibold">Import details</p><ul className="space-y-1">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}</div>}
    </div>
  )
}
