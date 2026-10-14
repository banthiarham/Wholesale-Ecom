"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Pencil, MoreVertical, Ban, Trash2, X, Mail, Phone, Building2, MapPin, Shield, Eye, Layers, Truck,
} from "lucide-react"
import { formatPrice, getContrastTextColor } from "@/lib/utils"
import { AdminStatusBadge, type AdminBadgeVariant } from "@/lib/adminStatusBadge"
import { paymentModeLabel } from "@/lib/paymentMode"

interface RoleData {
  id: string
  name: string
  label: string
  color: string | null
}

interface AddressData {
  id: string
  label?: string | null
  street: string
  city: string
  state: string
  zip: string
  country?: string | null
  isDefault: boolean
}

interface UserDetail {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  role: string
  roleId?: string | null
  roleRel?: { id: string; name: string; label: string; color: string | null } | null
  status: string
  accountType?: string
  emailVerified: boolean
  phoneVerified: boolean
  companyName?: string | null
  companyAddress?: string | null
  taxId?: string | null
  organizationName?: string | null
  gstin?: string | null
  panNumber?: string | null
  contactPersonName?: string | null
  pincode?: string | null
  city?: string | null
  state?: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
  addresses?: AddressData[]
}

interface OrderItem {
  quantity: number
  unitPrice: number | string
  totalPrice?: number | string
  metadata?: any
  product: { title: string; sku?: string | null }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number | string
  subtotal?: number | string | null
  taxAmount?: number | string | null
  shippingAmount?: number | string | null
  discountAmount?: number | string | null
  createdAt: string
  notes?: string | null
  trackingNumber?: string | null
  carrier?: string | null
  shippingAddress?: any
  items: OrderItem[]
  deliveryPartner?: { name: string } | null
  payment?: { provider?: string; status: string } | null
}

const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"]

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

function orderBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "PENDING": return { variant: "warning" }
    case "CONFIRMED":
    case "PROCESSING": return { variant: "primary" }
    case "SHIPPED": return { colorClassName: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" }
    case "DELIVERED": return { variant: "success" }
    case "CANCELLED":
    case "REFUNDED": return { variant: "neutral" }
    default: return { variant: "neutral" }
  }
}

const orderBadge = (status: string) => <AdminStatusBadge status={status} {...orderBadgeProps(status)} />

function userStatusVariant(status: string): AdminBadgeVariant {
  if (status === "ACTIVE") return "success"
  if (status === "SUSPENDED") return "danger"
  if (status === "PENDING_VERIFICATION") return "warning"
  return "neutral"
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 break-words">
        {value === undefined || value === null || value === "" ? <span className="text-gray-400 dark:text-gray-500">—</span> : value}
      </dd>
    </div>
  )
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : null)

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const [user, setUser] = useState<UserDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [roles, setRoles] = useState<RoleData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [ordersLoading, setOrdersLoading] = useState(true)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<"status" | "delete" | "edit" | null>(null)
  const [actionError, setActionError] = useState("")
  const [busy, setBusy] = useState(false)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

  const [form, setForm] = useState<Record<string, string>>({})

  const authHeaders = { Authorization: `Bearer ${token}` }

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(res.status === 404 ? "User not found" : data.message || "Failed to load user")
      }
      setUser(await res.json())
    } catch (err: any) {
      setError(err.message || "Failed to load user")
    } finally {
      setLoading(false)
    }
  }, [id, token])

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/orders?userId=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error(err)
    } finally {
      setOrdersLoading(false)
    }
  }, [id, token])

  useEffect(() => {
    loadUser()
    loadOrders()
    fetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setRoles(d.roles || []))
      .catch(() => {})
  }, [loadUser, loadOrders, token])

  // Close the three-dots menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const openEdit = () => {
    if (!user) return
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.roleId || user.roleRel?.id || "",
      companyName: user.companyName || "",
      companyAddress: user.companyAddress || "",
      taxId: user.taxId || "",
      organizationName: user.organizationName || "",
      gstin: user.gstin || "",
      panNumber: user.panNumber || "",
      contactPersonName: user.contactPersonName || "",
      city: user.city || "",
      state: user.state || "",
      pincode: user.pincode || "",
      password: "",
    })
    setActionError("")
    setModal("edit")
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setActionError("First name, last name and email are required")
      return
    }
    setBusy(true)
    setActionError("")
    try {
      // Blank optional fields are sent as "" so they can be cleared; password/role only when set/changed.
      const body: Record<string, string> = {}
      for (const [k, v] of Object.entries(form)) body[k] = k === "password" ? v : v.trim()
      if (!body.password) delete body.password
      if (!body.roleId || body.roleId === (user?.roleId || user?.roleRel?.id || "")) delete body.roleId
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message
        throw new Error(msg || "Failed to save changes")
      }
      setModal(null)
      await loadUser()
    } catch (err: any) {
      setActionError(err.message || "Failed to save changes")
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status: string) => {
    setBusy(true)
    setActionError("")
    try {
      const res = await fetch(`/api/users/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      setUser((u) => (u ? { ...u, status } : u))
      setModal(null)
    } catch (err: any) {
      setActionError(err.message || "Failed to update status")
    } finally {
      setBusy(false)
    }
  }

  const deleteUser = async () => {
    setBusy(true)
    setActionError("")
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE", headers: authHeaders })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "Failed to delete user")
      }
      router.push("/admin/users")
    } catch (err: any) {
      setActionError(err.message || "Failed to delete user")
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-48 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline">
          <ArrowLeft size={14} /> Back to users
        </Link>
        <div className="admin-card-static p-8 text-center text-sm text-gray-600 dark:text-gray-400">{error || "User not found"}</div>
      </div>
    )
  }

  const roleColor =
    user.roleRel?.color ||
    ({ ADMIN: "#EF4444", VENDOR: "#8B5CF6", DISTRIBUTOR: "#F59E0B" } as Record<string, string>)[user.role] ||
    "#3B82F6"
  const roleLabel = user.roleRel?.label || user.role
  const totalSpent = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0)
  const field = (key: string, label: string, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={INPUT_CLS}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
          <ArrowLeft size={14} /> Back to users
        </Link>
        <div className="admin-card-static p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-lg font-bold uppercase">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user.firstName} {user.lastName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: roleColor, color: getContrastTextColor(roleColor) }}
                >
                  <Shield size={12} /> {roleLabel}
                </span>
                <AdminStatusBadge status={user.status} variant={userStatusVariant(user.status)} label={user.status.replace(/_/g, " ")} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={openEdit}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
            >
              <Pencil size={14} /> Edit
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="p-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-48 z-20 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg shadow-lg py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setActionError(""); setModal("status") }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <Ban size={14} /> Change status
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setActionError(""); setModal("delete") }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} /> Delete user
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="admin-card-static p-5 lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Mail size={15} /> Contact</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="First name" value={user.firstName} />
              <DetailRow label="Last name" value={user.lastName} />
              <DetailRow label="Email" value={<>{user.email} {user.emailVerified && <span className="ml-1 text-xs text-green-600 dark:text-green-400">verified</span>}</>} />
              <DetailRow label="Phone" value={user.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} />{user.phone}{user.phoneVerified && <span className="ml-1 text-xs text-green-600 dark:text-green-400">verified</span>}</span> : null} />
              <DetailRow label="Contact person" value={user.contactPersonName} />
            </dl>
          </section>

          <section className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Building2 size={15} /> Company</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Company name" value={user.companyName} />
              <DetailRow label="Organization" value={user.organizationName} />
              <DetailRow label="Company address" value={user.companyAddress} />
              <DetailRow label="Tax ID" value={user.taxId} />
              <DetailRow label="GSTIN" value={user.gstin} />
              <DetailRow label="PAN" value={user.panNumber} />
              <DetailRow label="City" value={user.city} />
              <DetailRow label="State" value={user.state} />
              <DetailRow label="Pincode" value={user.pincode} />
            </dl>
          </section>

          {(user.addresses?.length ?? 0) > 0 && (
            <section className="border-t border-gray-100 dark:border-gray-800 pt-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><MapPin size={15} /> Saved addresses</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {user.addresses!.map((a) => (
                  <div key={a.id} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{a.label || "Address"}</span>
                      {a.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Default</span>}
                    </div>
                    <p>{a.street}</p>
                    <p>{a.city}, {a.state} {a.zip}</p>
                    {a.country && <p>{a.country}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <div className="admin-card-static p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Account</h2>
            <dl className="space-y-4">
              <DetailRow label="Role" value={roleLabel} />
              <DetailRow label="Status" value={user.status.replace(/_/g, " ")} />
              <DetailRow label="Sign-up method" value={user.accountType} />
              <DetailRow label="Joined" value={fmtDate(user.createdAt)} />
              <DetailRow label="Last login" value={fmtDate(user.lastLoginAt)} />
              <DetailRow label="Last updated" value={fmtDate(user.updatedAt)} />
            </dl>
          </div>
          <div className="admin-card-static p-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Orders</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{ordersLoading ? "…" : orders.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total spent</p>
              <p className="mt-1 text-xl font-semibold text-primary-700 dark:text-primary-400">{ordersLoading ? "…" : formatPrice(totalSpent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Past orders */}
      <div className="admin-card-static overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Past orders</h2>
        </div>
        {ordersLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">This user hasn&apos;t placed any orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {["Order", "Date", "Items", "Status", "Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setDetailOrder(o)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">#{o.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.items?.reduce((n, i) => n + i.quantity, 0) ?? 0}</td>
                    <td className="px-4 py-3">{orderBadge(o.status)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(o.totalAmount))}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailOrder(o) }}
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30"
                        title="View order"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order detail popup */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Order #{detailOrder.orderNumber}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(detailOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                {orderBadge(detailOrder.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Payment mode</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{paymentModeLabel(detailOrder.payment?.provider)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Payment status</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 uppercase">{(detailOrder.payment?.status || "PENDING").replace(/_/g, " ")}</span>
              </div>
              {(detailOrder.deliveryPartner || detailOrder.trackingNumber) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><Truck size={14} /> Delivery</span>
                  <div className="text-right">
                    {(detailOrder.deliveryPartner?.name || detailOrder.carrier) && (
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{detailOrder.deliveryPartner?.name || detailOrder.carrier}</span>
                    )}
                    {detailOrder.trackingNumber && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{detailOrder.trackingNumber}</p>}
                  </div>
                </div>
              )}
              {detailOrder.shippingAddress?.street && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Shipping address</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>{detailOrder.shippingAddress.street}</p>
                    <p>{detailOrder.shippingAddress.city}, {detailOrder.shippingAddress.state} {detailOrder.shippingAddress.zip}</p>
                    {detailOrder.shippingAddress.country && <p>{detailOrder.shippingAddress.country}</p>}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Items</h4>
                <div className="space-y-2">
                  {(detailOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-700 dark:text-gray-300 min-w-0">
                        {item.metadata?.packageId && <Layers size={12} className="inline mr-1 text-primary-600 dark:text-primary-400" />}
                        {item.product?.title} × {item.quantity}
                      </span>
                      <span className="font-medium shrink-0">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-1 text-sm">
                {detailOrder.subtotal != null && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span>{formatPrice(Number(detailOrder.subtotal))}</span></div>
                )}
                {Number(detailOrder.discountAmount) > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400"><span>Discount</span><span>-{formatPrice(Number(detailOrder.discountAmount))}</span></div>
                )}
                {Number(detailOrder.shippingAmount) > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Shipping</span><span>{formatPrice(Number(detailOrder.shippingAmount))}</span></div>
                )}
                {Number(detailOrder.taxAmount) > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Tax (GST)</span><span>{formatPrice(Number(detailOrder.taxAmount))}</span></div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                  <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{formatPrice(Number(detailOrder.totalAmount))}</span>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change status / delete */}
      {(modal === "status" || modal === "delete") && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{modal === "status" ? "Change Status" : "Delete User"}</h3>
              <button onClick={() => setModal(null)} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{user.firstName} {user.lastName} ({user.email})</p>
            {actionError && <div className="mb-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">{actionError}</div>}
            {modal === "status" ? (
              <div className="space-y-2">
                {USER_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                    className={`w-full py-2 rounded-lg border text-sm transition disabled:opacity-50 ${
                      user.status === s
                        ? "bg-primary-50 dark:bg-primary-900/30 border-primary-600 text-primary-700 dark:text-primary-400 font-medium"
                        : "border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone.</p>
                <button onClick={deleteUser} disabled={busy} className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50">
                  {busy ? "Deleting..." : "Delete User"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit user */}
      {modal === "edit" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit User</h3>
              <button onClick={() => setModal(null)} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              {actionError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">{actionError}</div>}
              <div className="grid grid-cols-2 gap-4">
                {field("firstName", "First Name", "text", true)}
                {field("lastName", "Last Name", "text", true)}
              </div>
              {field("email", "Email", "email", true)}
              {field("phone", "Phone", "tel")}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select value={form.roleId ?? ""} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))} className={INPUT_CLS}>
                  {!form.roleId && <option value="">{user.role}</option>}
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              {field("companyName", "Company Name")}
              {field("companyAddress", "Company Address")}
              {field("organizationName", "Organization")}
              {field("contactPersonName", "Contact Person")}
              <div className="grid grid-cols-2 gap-4">
                {field("taxId", "Tax ID")}
                {field("gstin", "GSTIN")}
              </div>
              {field("panNumber", "PAN")}
              <div className="grid grid-cols-3 gap-4">
                {field("city", "City")}
                {field("state", "State")}
                {field("pincode", "Pincode")}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password <span className="text-gray-400 dark:text-gray-500">(optional, min 6 chars)</span></label>
                <input type="password" autoComplete="new-password" value={form.password ?? ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep current" className={INPUT_CLS} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} disabled={busy} className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">{busy ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
