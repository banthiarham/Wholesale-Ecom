"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Shield, User, Ban, Trash2, X, Plus, Upload } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { getContrastTextColor } from "@/lib/utils"

interface RoleData {
  id: string
  name: string
  label: string
  color: string | null
  icon: string | null
  isSystem: boolean
}

interface UserData {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  roleId?: string | null
  roleRel?: { id: string; name: string; label: string; color: string | null; icon: string | null } | null
  status: string
  createdAt: string
  phone?: string | null
}

const PAGE_SIZE_OPTIONS = [20, 30, 50, 100]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [roles, setRoles] = useState<RoleData[]>([])
  const [loading, setLoading] = useState(true) // first load only (skeleton)
  const [fetching, setFetching] = useState(false) // any reload (dims the table)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortKey, setSortKey] = useState<keyof UserData>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const requestRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const [modalUser, setModalUser] = useState<UserData | null>(null)
  const [modalAction, setModalAction] = useState<"role" | "status" | "delete" | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addError, setAddError] = useState("")
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    role: "BUYER",
    status: "ACTIVE",
    companyName: "",
    companyAddress: "",
    taxId: "",
  })
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadRoles()
  }, [token])

  // Search is sent to the server (it searches ALL users, not just this page). Wait for a
  // short pause in typing before asking, and jump back to page 1 for every new search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadUsers = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!hasLoadedRef.current) setLoading(true)
    setFetching(true)
    try {
      const params = new URLSearchParams({
        skip: String((page - 1) * pageSize),
        take: String(pageSize),
        sortBy: String(sortKey),
        sortDir: sortDesc ? "desc" : "asc",
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/users?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (requestId !== requestRef.current) return // a newer request superseded this one
      const list: UserData[] = data.users || []
      const count: number = typeof data.total === "number" ? data.total : list.length
      setTotal(count)
      // The current page no longer exists (e.g. its last user was deleted): step back.
      if (list.length === 0 && count > 0 && page > 1) {
        setPage(Math.max(1, Math.ceil(count / pageSize)))
        return
      }
      setUsers(list)
      hasLoadedRef.current = true
    } catch (err) {
      console.error(err)
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false)
        setFetching(false)
      }
    }
  }, [token, page, pageSize, sortKey, sortDesc, debouncedSearch])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const loadRoles = async () => {
    try {
      const res = await fetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setRoles(data.roles || [])
    } catch (err) {
      console.error(err)
    }
  }

  const updateRole = async (userId: string, roleId: string) => {
    setUpdatingRole(true)
    try {
      await fetch(`/api/users/${userId}/assign-role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roleId }),
      })
      // Refresh users to get updated role info
      await loadUsers()
    } catch (err) {
      console.error(err)
    }
    setUpdatingRole(false)
    setModalAction(null)
  }

  const updateStatus = async (userId: string, status: string) => {
    try {
      await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
    } catch (err) {
      console.error(err)
    }
    setModalAction(null)
  }

  const deleteUser = async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      // Reload so the page refills from the next users and the total stays correct.
      await loadUsers()
    } catch (err) {
      console.error(err)
    }
    setModalAction(null)
  }

  const resetAddForm = () => {
    setAddForm({ firstName: "", lastName: "", email: "", password: "", phone: "", role: "BUYER", status: "ACTIVE", companyName: "", companyAddress: "", taxId: "" })
    setAddError("")
  }

  const friendlyAddUserError = (errData: { message?: string | string[] }): string => {
    const raw = errData?.message
    if (Array.isArray(raw)) {
      // Raw class-validator messages should never reach the UI as-is.
      if (raw.some((m) => /email/i.test(m))) return "Please enter a valid email address"
      if (raw.some((m) => /role/i.test(m))) return "Invalid role selected"
      if (raw.some((m) => /firstName|lastName|should not exist/i.test(m))) return "Please fill all required fields"
      return "Please fill all required fields"
    }
    if (typeof raw === "string") {
      if (/email/i.test(raw) && /(already|exists|registered)/i.test(raw)) return "Email already exists"
      if (/role/i.test(raw)) return "Invalid role selected"
      return raw
    }
    return "Failed to create user"
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError("")
    if (!addForm.email.trim() || !addForm.firstName.trim() || !addForm.lastName.trim()) {
      setAddError("Please fill all required fields")
      return
    }
    setAddSubmitting(true)
    try {
      const body: Record<string, string | undefined> = {
        email: addForm.email.trim(),
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        role: addForm.role,
        status: addForm.status,
      }
      if (addForm.password) body.password = addForm.password
      if (addForm.phone) body.phone = addForm.phone.trim()
      if (addForm.companyName) body.companyName = addForm.companyName.trim()
      if (addForm.companyAddress) body.companyAddress = addForm.companyAddress.trim()
      if (addForm.taxId) body.taxId = addForm.taxId.trim()
      const matchedRole = roles.find((r) => r.name === addForm.role)
      if (matchedRole) body.roleId = matchedRole.id

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(friendlyAddUserError(errData))
      }
      setShowAddModal(false)
      resetAddForm()
      loadUsers()
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setAddSubmitting(false)
    }
  }

  const SortIcon = ({ col }: { col: keyof UserData }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="text-gray-300 dark:text-gray-600" />
    return sortDesc ? <ChevronDown size={14} className="text-primary-600 dark:text-primary-400" /> : <ChevronUp size={14} className="text-primary-600 dark:text-primary-400" />
  }

  const getRoleBadgeColor = (user: UserData) => {
    if (user.roleRel?.color) return user.roleRel.color
    switch (user.role) {
      case "ADMIN": return "#EF4444"
      case "VENDOR": return "#8B5CF6"
      case "DISTRIBUTOR": return "#F59E0B"
      default: return "#3B82F6"
    }
  }

  const getRoleLabel = (user: UserData) => {
    return user.roleRel?.label || user.role
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Compact page list: always first/last, the current page and its neighbours, "…" for gaps.
  const pageNumbers = (current: number, last: number): (number | "…")[] => {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
    const pages = new Set([1, last, current - 1, current, current + 1])
    const sorted = Array.from(pages).filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
    const out: (number | "…")[] = []
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push("…")
      out.push(p)
    })
    return out
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm w-64"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{total} user{total !== 1 ? "s" : ""}</span>
          <Link href="/admin/users/bulk-upload" className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">
            <Upload size={16} /> Bulk Upload
          </Link>
          <button
            onClick={() => { setShowAddModal(true); resetAddForm() }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${fetching ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {[
                    { key: "firstName" as const, label: "Name" },
                    { key: "email" as const, label: "Email" },
                    { key: "role" as const, label: "Role" },
                    { key: "status" as const, label: "Status" },
                    { key: "createdAt" as const, label: "Joined" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none"
                      onClick={() => {
                        if (sortKey === col.key) setSortDesc(!sortDesc)
                        else { setSortKey(col.key); setSortDesc(true) }
                        setPage(1)
                      }}
                    >
                      <div className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      {debouncedSearch ? `No users match "${debouncedSearch}"` : "No users found"}
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-xs font-bold">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: getRoleBadgeColor(u), color: getContrastTextColor(getRoleBadgeColor(u)) }}
                      >
                        <Shield size={12} />
                        {getRoleLabel(u)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                        u.status === "ACTIVE" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {u.status === "ACTIVE" ? <User size={12} /> : <Ban size={12} />}
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setModalUser(u); setModalAction("role") }}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30"
                          title="Change role"
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          onClick={() => { setModalUser(u); setModalAction("status") }}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          title="Change status"
                        >
                          <Ban size={16} />
                        </button>
                        <button
                          onClick={() => { setModalUser(u); setModalAction("delete") }}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <label htmlFor="users-page-size" className="whitespace-nowrap">Rows per page</label>
              <select
                id="users-page-size"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="whitespace-nowrap">
                {total === 0 ? "0 of 0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {pageNumbers(page, totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={`min-w-[2rem] rounded-lg border px-2 py-1 ${
                      n === page
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Next page"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modalAction && modalUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-80 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {modalAction === "role" && "Change Role"}
                {modalAction === "status" && "Change Status"}
                {modalAction === "delete" && "Delete User"}
              </h3>
              <button onClick={() => setModalAction(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {modalUser.firstName} {modalUser.lastName} ({modalUser.email})
            </p>
            {modalAction === "role" && (
              <div className="space-y-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => updateRole(modalUser.id, r.id)}
                    disabled={updatingRole}
                    className={`w-full py-2 rounded-lg border text-sm transition flex items-center gap-2 ${
                      modalUser.roleId === r.id || modalUser.role === r.name
                        ? "bg-primary-50 dark:bg-primary-900/30 border-primary-600 text-primary-700 dark:text-primary-400 font-medium"
                        : "border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    } ${updatingRole ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: r.color || "#6B7280" }}
                    >
                      <Shield size={10} />
                    </span>
                    {r.label}
                    {r.isSystem && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(System)</span>}
                  </button>
                ))}
              </div>
            )}
            {modalAction === "status" && (
              <div className="space-y-2">
                {["ACTIVE", "INACTIVE", "SUSPENDED"].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(modalUser.id, s)}
                    className={`w-full py-2 rounded-lg border text-sm transition ${
                      modalUser.status === s
                        ? "bg-primary-50 dark:bg-primary-900/30 border-primary-600 text-primary-700 dark:text-primary-400 font-medium"
                        : "border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {modalAction === "delete" && (
              <div className="space-y-3">
                <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone.</p>
                <button
                  onClick={() => deleteUser(modalUser.id)}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                >
                  Delete User
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              {addError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">{addError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                  <input type="text" required value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                  <input type="text" required value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password <span className="text-gray-400 dark:text-gray-500">(optional, min 6 chars)</span></label>
                <input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} placeholder="Leave blank for invitation-only" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={addForm.status} onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                <input type="text" value={addForm.companyName} onChange={(e) => setAddForm((f) => ({ ...f, companyName: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Address</label>
                <input type="text" value={addForm.companyAddress} onChange={(e) => setAddForm((f) => ({ ...f, companyAddress: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax ID</label>
                <input type="text" value={addForm.taxId} onChange={(e) => setAddForm((f) => ({ ...f, taxId: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition" disabled={addSubmitting}>Cancel</button>
                <button type="submit" disabled={addSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">{addSubmitting ? "Creating..." : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
