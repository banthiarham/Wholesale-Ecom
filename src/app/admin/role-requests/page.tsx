"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, ShieldX, Clock, User, ChevronRight, X, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED"

interface RoleChangeRequest {
  id: string
  userId: string
  roleId: string
  status: RequestStatus
  reason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  role?: {
    id: string
    name: string
    label: string
    color: string
    icon: string
  }
}

const statusConfig: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700", icon: <XCircle size={12} /> },
}

const roleIconMap: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck size={12} />,
  ShieldAlert: <ShieldAlert size={12} />,
  ShieldX: <ShieldX size={12} />,
  User: <User size={12} />,
}

const tabs: { key: RequestStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
]

export default function AdminRoleRequestsPage() {
  const [requests, setRequests] = useState<RoleChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<RequestStatus>("PENDING")
  const [counts, setCounts] = useState<{ PENDING: number; APPROVED: number; REJECTED: number }>({
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  })
  const [detailRequest, setDetailRequest] = useState<RoleChangeRequest | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadRequests()
  }, [token])

  useEffect(() => {
    if (token) {
      loadRequests()
    }
  }, [activeTab])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/role-requests?status=${activeTab}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setRequests(data.requests || [])

      // Fetch counts for all tabs
      const countPromises = tabs.map(async (tab) => {
        const r = await fetch(`/api/role-requests?status=${tab.key}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        })
        const d = await r.json()
        return { key: tab.key, count: d.count ?? (d.requests || []).length }
      })
      const countResults = await Promise.all(countPromises)
      setCounts((prev) => ({
        ...prev,
        PENDING: countResults.find((c) => c.key === "PENDING")?.count ?? prev.PENDING,
        APPROVED: countResults.find((c) => c.key === "APPROVED")?.count ?? prev.APPROVED,
        REJECTED: countResults.find((c) => c.key === "REJECTED")?.count ?? prev.REJECTED,
      }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/role-requests/${id}/${action}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setToast({
          type: "success",
          message: `Request ${action === "approve" ? "approved" : "rejected"} successfully`,
        })
        // Refresh list
        await loadRequests()
      } else {
        setToast({ type: "error", message: `Failed to ${action} request` })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: "error", message: "Something went wrong" })
    } finally {
      setActionLoading(null)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const renderRoleBadge = (role: RoleChangeRequest["role"]) => {
    if (!role) return <span className="text-gray-400 text-sm">Unknown</span>
    const bgColor = role.color ? `${role.color}` : "bg-gray-100"
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bgColor}`}
      >
        {roleIconMap[role.icon] || <ShieldCheck size={12} />}
        {role.label || role.name}
      </span>
    )
  }

  const renderStatusBadge = (status: RequestStatus) => {
    const cfg = statusConfig[status]
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cfg.color}`}>
        {cfg.icon}
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Role Change Requests</h1>
        <span className="text-sm text-gray-500">
          {requests.length} request{requests.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                activeTab === tab.key
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : requests.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <ShieldCheck size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No {activeTab.toLowerCase()} role requests found.</p>
        </div>
      ) : (
        /* Requests Table */
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Requested Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reviewed By</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => setDetailRequest(req)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                          {req.user?.firstName?.[0]}{req.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {req.user?.firstName} {req.user?.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{req.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderRoleBadge(req.role)}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600 max-w-[200px] truncate">
                        {req.reason || <span className="text-gray-400 italic">No reason provided</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">{renderStatusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {req.reviewedBy ? req.reviewedBy : <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {req.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(req.id, "approve")}
                            disabled={actionLoading === req.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} />
                            {actionLoading === req.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, "reject")}
                            disabled={actionLoading === req.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle size={14} />
                            {actionLoading === req.id ? "..." : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
              <button
                onClick={() => setDetailRequest(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* User Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">User</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                    {detailRequest.user?.firstName?.[0]}{detailRequest.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {detailRequest.user?.firstName} {detailRequest.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{detailRequest.user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Requested Role */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Requested Role</h4>
                {renderRoleBadge(detailRequest.role)}
              </div>

              {/* Reason */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reason</h4>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                  {detailRequest.reason || (
                    <span className="text-gray-400 italic">No reason provided</span>
                  )}
                </p>
              </div>

              {/* Status */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h4>
                {renderStatusBadge(detailRequest.status)}
              </div>

              {/* Review History */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Review History</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <p>
                    <span className="text-gray-500">Submitted:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(detailRequest.createdAt).toLocaleString()}
                    </span>
                  </p>
                  {detailRequest.reviewedBy && (
                    <p>
                      <span className="text-gray-500">Reviewed by:</span>{" "}
                      <span className="text-gray-900">{detailRequest.reviewedBy}</span>
                    </p>
                  )}
                  {detailRequest.reviewedAt && (
                    <p>
                      <span className="text-gray-500">Reviewed at:</span>{" "}
                      <span className="text-gray-900">
                        {new Date(detailRequest.reviewedAt).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {detailRequest.updatedAt !== detailRequest.createdAt && (
                    <p>
                      <span className="text-gray-500">Last updated:</span>{" "}
                      <span className="text-gray-900">
                        {new Date(detailRequest.updatedAt).toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            {detailRequest.status === "PENDING" && (
              <div className="flex gap-3 p-5 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleAction(detailRequest.id, "approve")
                    setDetailRequest(null)
                  }}
                  disabled={actionLoading === detailRequest.id}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    handleAction(detailRequest.id, "reject")
                    setDetailRequest(null)
                  }}
                  disabled={actionLoading === detailRequest.id}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}