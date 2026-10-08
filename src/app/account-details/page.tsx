"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Landmark, Info } from "lucide-react"
import { BankAccountCard, fetchBankAccounts, type BankAccount } from "@/components/storefront/BankAccounts"

export default function AccountDetailsPage() {
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null)

  useEffect(() => {
    fetchBankAccounts().then(setAccounts)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <span className="eyebrow">Payments</span>
            <h1 className="heading-lg">Account Details</h1>
            <p className="body-sm mt-1.5">Bank accounts you can pay into when you choose Bank Transfer at checkout.</p>
          </div>

          <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3 mb-6 text-sm text-gray-700">
            <Info size={18} className="text-primary-600 shrink-0 mt-0.5" />
            <p>After transferring, your order stays <strong>Pending</strong> until we receive the payment. Keep your order number as the payment reference and contact us if you need help.</p>
          </div>

          {accounts === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((i) => <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="card-base-static p-10 text-center">
              <Landmark size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">Bank transfer details are not available right now.</p>
              <Link href="/contact" className="btn-outline inline-flex mt-4">Contact us</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((a, i) => (
                <BankAccountCard key={a.id} account={a} title={accounts.length > 1 ? `Bank Account ${i + 1}` : "Bank Account"} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
