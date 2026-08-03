"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, ArrowLeft, Check, X, Clock } from "lucide-react"
import { getContrastTextColor } from "@/lib/utils"

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
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<{ action: string; resource: string; description: string | null }[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [rolesError, setRolesError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    // Each fetch is tracked independently: an auth failure means the session is
    // invalid (redirect to login), but a roles-fetch failure should surface as an
    // inline error rather than silently becoming an empty dropdown or logging the
    // user out of an otherwise-valid session.
    Promise.allSettled([
      fetch("/api/auth/me", { headers }).then((r) => {
        if (!r.ok) throw new Error("Unauthorized")
        return r.json()
      }),
      fetch("/api/roles/public", { headers }).then(async (r) => {
        if (!r.ok) throw new Error("Failed to load roles")
        const d = await r.json()
        return d.roles || []
      }),
      fetch("/api/role-requests/mine", { headers }).then(async (r) => {
        if (!r.ok) throw new Error("Failed to load your requests")
        const d = await r.json()
        return d.requests || []
      }),
    ]).then(([userResult, rolesResult, requestsResult]) => {
      if (userResult.status === "rejected") {
        localStorage.removeItem("token")
        router.push("/login")
        return
      }
      setUser(userResult.value.user || userResult.value)

      if (rolesResult.status === "fulfilled") {
        setRoles(rolesResult.value)
        setRolesError(null)
      } else {
        setRoles([])
        setRolesError("Unable to load roles right now. Please try again later.")
      }

      setMyRequests(requestsResult.status === "fulfilled" ? requestsResult.value : [])
      setLoading(false)
    })
  }, [router])

  // Fetch permissions for the selected role
  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedRolePermissions([])
      return
    }
    setLoadingPermissions(true)
    const token = localStorage.getItem("token")
    fetch(`/api/roles/${selectedRoleId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const role = data.role || data
        setSelectedRolePermissions(role.permissions || [])
      })
      .catch(() => setSelectedRolePermissions([]))
      .finally(() => setLoadingPermissions(false))
  }, [selectedRoleId])

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
        return <span className="badge-warning inline-flex items-center gap-1"><Clock size={12} /> Pending</span>
      case "APPROVED":
        return <span className="badge-success inline-flex items-center gap-1"><Check size={12} /> Approved</span>
      case "REJECTED":
        return <span className="badge-danger inline-flex items-center gap-1"><X size={12} /> Rejected</span>
      default:
        return <span className="text-gray-500">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="section-container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="eyebrow">Account</span>
            <h1 className="heading-xl">Role Change Request</h1>
            <p className="body-sm mt-1">Request a different role to access different pricing and features</p>
          </div>
        </div>

        {/* Current Role */}
        <div className="card-base-static p-6 mb-6">
          <h2 className="heading-sm mb-3">Current Role</h2>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: user?.roleRel?.color || "#6B7280", color: getContrastTextColor(user?.roleRel?.color || "#6B7280") }}
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
        <div className="card-base-static p-6 mb-6">
          <h2 className="heading-sm mb-4">Request a New Role</h2>

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
              {rolesError ? (
                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                  {rolesError}
                </div>
              ) : availableRoles.length === 0 ? (
                <div className="p-3 rounded-lg text-sm bg-gray-50 text-gray-500 border border-gray-200 text-center">
                  No roles available for request.
                </div>
              ) : (
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="input-base"
                >
                  <option value="">— Choose a role —</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label} {role.isSystem ? "(System)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedRoleId && (
              <div className="bg-primary-50/40 border border-primary-100 rounded-xl p-4">
                {(() => {
                  const selectedRole = availableRoles.find((r) => r.id === selectedRoleId)
                  if (!selectedRole) return null
                  return (
                    <div>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: selectedRole.color || "#6B7280", color: getContrastTextColor(selectedRole.color || "#6B7280") }}
                        >
                          <Shield size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{selectedRole.label}</p>
                          {selectedRole.description && (
                            <p className="text-sm text-gray-500">{selectedRole.description}</p>
                          )}
                        </div>
                      </div>
                      {/* Permission Preview */}
                      {loadingPermissions ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          Loading permissions...
                        </div>
                      ) : selectedRolePermissions.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-gray-700 mb-2">This role grants access to:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedRolePermissions.map((p) => (
                              <span key={`${p.action}-${p.resource}`} className="badge-primary">
                                {p.action}:{p.resource}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-400 italic">No specific permissions defined for this role.</p>
                      )}
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
                className="input-base resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedRoleId}
              className="btn-primary w-full justify-center"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>

        {/* Past Requests */}
        <div className="card-base-static p-6">
          <h2 className="heading-sm mb-4">Your Requests</h2>
          {myRequests.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No role change requests yet.</p>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div key={req.id} className="card-interactive flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: req.role?.color || "#6B7280", color: getContrastTextColor(req.role?.color || "#6B7280") }}
                    >
                      <Shield size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{req.role?.label || "Unknown Role"}</p>
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