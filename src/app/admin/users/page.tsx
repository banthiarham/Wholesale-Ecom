"use client"

import { useEffect, useState } from "react"
import { Search, ChevronDown, ChevronUp, Shield, User, Ban, Trash2, X } from "lucide-react"

interface UserData {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt: string
  phone?: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [filtered, setFiltered] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<keyof UserData>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
  const [modalUser, setModalUser] = useState<UserData | null>(null)
  const [modalAction, setModalAction] = useState<"role" | "status" | "delete" | null>(null)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadUsers()
  }, [token])

  useEffect(() => {
    const q = search.toLowerCase()
    const result = users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
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

  const updateRole = async (userId: string, role: string) => {
    try {
      await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch (err) {
      console.error(err)
    }
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

  const SortIcon = ({ col }: { col: keyof UserData }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="text-gray-300" />
    return sortDesc ? <ChevronDown size={14} className="text-primary-600" /> : <ChevronUp size={14} className="text-primary-600" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
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
                      className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => {
                        if (sortKey === col.key) setSortDesc(!sortDesc)
                        else { setSortKey(col.key); setSortDesc(true) }
                      }}
                    >
                      <div className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                        u.role === "ADMIN" ? "bg-red-50 text-red-700" : u.role === "VENDOR" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {u.role === "ADMIN" && <Shield size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                        u.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.status === "ACTIVE" ? <User size={12} /> : <Ban size={12} />}
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setModalUser(u); setModalAction("role") }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"
                          title="Change role"
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          onClick={() => { setModalUser(u); setModalAction("status") }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50"
                          title="Change status"
                        >
                          <Ban size={16} />
                        </button>
                        <button
                          onClick={() => { setModalUser(u); setModalAction("delete") }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
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
          <div className="bg-white rounded-lg shadow-lg p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {modalAction === "role" && "Change Role"}
                {modalAction === "status" && "Change Status"}
                {modalAction === "delete" && "Delete User"}
              </h3>
              <button onClick={() => setModalAction(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {modalUser.firstName} {modalUser.lastName} ({modalUser.email})
            </p>
            {modalAction === "role" && (
              <div className="space-y-2">
                {["BUYER", "VENDOR", "ADMIN"].map((r) => (
                  <button
                    key={r}
                    onClick={() => updateRole(modalUser.id, r)}
                    className={`w-full py-2 rounded-lg border text-sm transition ${
                      modalUser.role === r
                        ? "bg-primary-50 border-primary-600 text-primary-700 font-medium"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {r}
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
                        ? "bg-primary-50 border-primary-600 text-primary-700 font-medium"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {modalAction === "delete" && (
              <div className="space-y-3">
                <p className="text-sm text-red-600">This action cannot be undone.</p>
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
    </div>
  )
}
