"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { X, ShoppingCart, ShoppingBag, Minus, Plus, Trash2, Package, ArrowRight } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { clampQuantity, calcLineTotal } from "@/lib/pricing"
import { useQuantityStepper } from "@/lib/pricing/useQuantityStepper"
import { useToast } from "./Toast"
import { EmptyState } from "./EmptyState"

interface DrawerCartItem {
  id: string
  quantity: number
  unitPrice: number
  product: {
    id: string
    title: string
    handle: string
    thumbnail: string | null
    moq: number
    inventoryQuantity: number
  }
}

interface DrawerCartData {
  cart: { id: string; items: DrawerCartItem[] }
  totals: { subtotal: number; itemCount: number; total: number }
}

interface CartDrawerContextType {
  openCartDrawer: () => void
  closeCartDrawer: () => void
}

const CartDrawerContext = createContext<CartDrawerContextType>({
  openCartDrawer: () => {},
  closeCartDrawer: () => {},
})

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const headers: Record<string, string> = { "x-session-id": getCartSessionId(), ...extra }
  if (token) headers["Authorization"] = `Bearer ${token}`
  return headers
}

// Extracted so useQuantityStepper (a hook) can be called once per row, not inside
// the parent's .map() callback — hooks can't be called conditionally/in a loop.
function CartDrawerRow({
  item,
  updating,
  onCommitQty,
  onRemove,
  onNavigate,
}: {
  item: DrawerCartItem
  updating: boolean
  onCommitQty: (quantity: number) => void
  onRemove: () => void
  onNavigate: () => void
}) {
  // Shared stepper: reseeds from the server-confirmed item.quantity whenever it changes,
  // steps by exactly 1 via functional state updates, and debounces the commit.
  const { qty, increment, decrement, atMin } = useQuantityStepper(
    item.quantity, item.quantity, item.product.moq, item.product.inventoryQuantity, onCommitQty
  )

  return (
    <div className="flex gap-3 p-4 hover:bg-gray-50/60 transition-colors">
      <Link href={`/products/${item.product.handle}`} onClick={onNavigate} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-50">
        {item.product.thumbnail ? (
          <Image src={item.product.thumbnail} alt={item.product.title} width={64} height={64} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package size={22} className="text-gray-300" />
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${item.product.handle}`} onClick={onNavigate} className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-primary-600 transition-colors">
            {item.product.title}
          </Link>
          <button onClick={onRemove} disabled={updating} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50" aria-label="Remove item">
            <Trash2 size={15} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{formatPrice(item.unitPrice)} / unit</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={decrement}
              disabled={updating || atMin}
              title={atMin ? `Minimum order quantity is ${item.product.moq}` : undefined}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Minus size={12} />
            </button>
            <span className="w-7 text-center text-sm font-medium tabular-nums">{qty}</span>
            <button
              onClick={increment}
              disabled={updating}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
            </button>
          </div>
          <span className="text-sm font-semibold text-gray-900">{formatPrice(calcLineTotal(item.unitPrice, qty))}</span>
        </div>
      </div>
    </div>
  )
}

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<DrawerCartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { showToast } = useToast()

  const fetchCart = useCallback(() => {
    setLoading(true)
    fetch("/api/cart", { headers: buildHeaders(), cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openCartDrawer = useCallback(() => {
    setIsOpen(true)
    fetchCart()
  }, [fetchCart])

  const closeCartDrawer = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return
    const handler = () => fetchCart()
    window.addEventListener("cart-updated", handler)
    return () => window.removeEventListener("cart-updated", handler)
  }, [isOpen, fetchCart])

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCartDrawer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, closeCartDrawer])

  const updateQty = async (item: DrawerCartItem, quantity: number) => {
    const clamped = clampQuantity(quantity, item.product.moq, item.product.inventoryQuantity)
    if (clamped === item.quantity) return
    setUpdatingId(item.id)
    try {
      const res = await fetch("/api/cart", { method: "PUT", headers: buildHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ itemId: item.id, quantity: clamped }) })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        window.dispatchEvent(new CustomEvent("cart-updated"))
      } else {
        showToast("error", "Could not update quantity")
      }
    } catch {
      showToast("error", "Something went wrong")
    } finally {
      setUpdatingId(null)
    }
  }

  const removeItem = async (item: DrawerCartItem) => {
    setUpdatingId(item.id)
    try {
      const res = await fetch("/api/cart", { method: "DELETE", headers: buildHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ itemId: item.id }) })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        window.dispatchEvent(new CustomEvent("cart-updated"))
      } else {
        showToast("error", "Could not remove item")
      }
    } catch {
      showToast("error", "Something went wrong")
    } finally {
      setUpdatingId(null)
    }
  }

  const items = data?.cart.items ?? []
  const totals = data?.totals ?? { subtotal: 0, itemCount: 0, total: 0 }

  return (
    <CartDrawerContext.Provider value={{ openCartDrawer, closeCartDrawer }}>
      {children}
      <div className={`fixed inset-0 z-[95] ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!isOpen}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeCartDrawer}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cart"
          className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-[var(--shadow-elevated)] flex flex-col transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <ShoppingCart size={20} className="text-primary-600" />
              <h2 className="heading-sm">Your Cart</h2>
              {totals.itemCount > 0 && <span className="badge badge-primary">{totals.itemCount}</span>}
            </div>
            <button onClick={closeCartDrawer} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors" aria-label="Close cart">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && !data ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3.5 w-3/4 bg-gray-100 rounded" />
                      <div className="h-3 w-1/2 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="h-full">
                <EmptyState
                  icon={ShoppingBag}
                  title="Your cart is empty"
                  description="Add some products to get started."
                  action={{ label: "Browse Products", href: "/products" }}
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <CartDrawerRow
                    key={item.id}
                    item={item}
                    updating={updatingId === item.id}
                    onCommitQty={(newQty) => updateQty(item, newQty)}
                    onRemove={() => removeItem(item)}
                    onNavigate={closeCartDrawer}
                  />
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-lg font-bold text-gray-900">{formatPrice(totals.subtotal)}</span>
              </div>
              <p className="text-xs text-gray-400">Taxes, discounts, and shipping calculated at checkout.</p>
              <div className="flex gap-2.5 pt-1">
                <Link href="/cart" onClick={closeCartDrawer} className="btn-outline flex-1 justify-center">
                  View Cart
                </Link>
                <Link href="/checkout" onClick={closeCartDrawer} className="btn-primary flex-1 justify-center gap-1.5">
                  Checkout <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </CartDrawerContext.Provider>
  )
}

export function useCartDrawer() {
  return useContext(CartDrawerContext)
}
