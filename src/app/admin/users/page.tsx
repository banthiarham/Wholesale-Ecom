"use client"

import { useEffect, useState } from "react"
import { Search, ChevronDown, ChevronUp, Shield, User, Ban, Trash2, X, Plus } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [roles, setRoles] = useState<RoleData[]>([])
  const [filtered, setFiltered] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<keyof UserData>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
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
    loadUsers()
    loadRoles()
  }, [token])

  useEffect(() => {
    const q = search.toLowerCase()
    const result = users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        (u.roleRel?.label || u.role).toLowerCase().includes(q)
    )
    result.sort((a, b) => {
      const av = a[sortKey] ?? ""
      const bv = b[sortKey] ?? ""
      return sortDesc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1
    })
    setFiltered(result)
  }, [users, search, sortKey, sortDesc])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      console.error(err)
    }
    setModalAction(null)
  }

  const resetAddForm = () => {
    setAddForm({ firstName: "", lastName: "", email: "", password: "", phone: "", role: "BUYER", status: "ACTIVE", companyName: "", companyAddress: "", taxId: "" })
    setAddError("")
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError("")
    if (!addForm.email.trim() || !addForm.firstName.trim() || !addForm.lastName.trim()) {
      setAddError("Email, first name, and last name are required.")
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
        throw new Error(errData.message || "Failed to create user")
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
          <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
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
                      }}
                    >
                      <div className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((u) => (
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getRoleBadgeColor(u) }}
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
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm" disabled={addSubmitting}>Cancel</button>
                <button type="submit" disabled={addSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">{addSubmitting ? "Creating..." : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
