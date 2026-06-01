"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, ArrowLeft, Check, X, Clock } from "lucide-react"

interface Role {
  id: string
  name: string
  label: string
  description: string | null
  isSystem: boolean
  color: string | null
  icon: string | null
}

interface RoleChangeRequest {
  id: string
  userId: string
  roleId: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  reason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  role?: { id: string; name: string; label: string; color: string | null; icon: string | null }
}

export default function RoleRequestPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [myRequests, setMyRequests] = useState<RoleChangeRequest[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch("/api/auth/me", { headers }).then((r) => r.json()),
      fetch("/api/roles", { headers }).then((r) => r.json()).then((d) => d.roles || []),
      fetch("/api/role-requests/mine", { headers }).then((r) => r.json()).then((d) => d.requests || []),
    ])
      .then(([userData, rolesData, requestsData]) => {
        setUser(userData.user || userData)
        setRoles(rolesData)
        setMyRequests(requestsData)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem("token")
        router.push("/login")
      })
  }, [router])

  const handleSubmit = async () => {
    if (!selectedRoleId) {
      setMessage({ type: "error", text: "Please select a role" })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/role-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roleId: selectedRoleId, reason: reason || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to submit request")
      }

      setMessage({ type: "success", text: "Role change request submitted successfully!" })
      setSelectedRoleId("")
      setReason("")

      // Refresh requests
      const requestsRes = await fetch("/api/role-requests/mine", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const requestsData = await requestsRes.json()
      setMyRequests(requestsData.requests || [])
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to submit request" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Filter out the user's current role
  const currentRoleName = user?.roleRel?.name || user?.role
  const availableRoles = roles.filter((r) => r.name !== currentRoleName)

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} /> Pending
          </span>
        )
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check size={12} /> Approved
          </span>
        )
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <X size={12} /> Rejected
          </span>
        )
      default:
        return <span className="text-gray-500">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Change Request</h1>
            <p className="text-sm text-gray-500 mt-1">Request a different role to access different pricing and features</p>
          </div>
        </div>

        {/* Current Role */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Current Role</h2>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: user?.roleRel?.color || "#6B7280" }}
            >
              <Shield size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {user?.roleRel?.label || currentRoleName || "No role assigned"}
              </p>
              <p className="text-sm text-gray-500">
                {user?.roleRel?.description || `Your current role is ${currentRoleName}`}
              </p>
            </div>
          </div>
        </div>

        {/* Request Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Request a New Role</h2>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">— Choose a role —</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label} {role.isSystem ? "(System)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoleId && (
              <div className="bg-gray-50 rounded-lg p-4">
                {(() => {
                  const selectedRole = availableRoles.find((r) => r.id === selectedRoleId)
                  if (!selectedRole) return null
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: selectedRole.color || "#6B7280" }}
                      >
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{selectedRole.label}</p>
                        {selectedRole.description && (
                          <p className="text-sm text-gray-500">{selectedRole.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why do you need this role?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedRoleId}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>

        {/* Past Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Requests</h2>
          {myRequests.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No role change requests yet.</p>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: req.role?.color || "#6B7280" }}
                    >
                      <Shield size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{req.role?.label || "Unknown Role"}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(req.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}