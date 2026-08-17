"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Package, Printer } from "lucide-react"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"

interface Address { name?: string; company?: string; street?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string; postalCode?: string; country?: string; gstin?: string; gstNumber?: string }
interface InvoiceOrder {
  id: string; orderNumber: string; totalAmount: number; subtotal?: number | null; taxAmount?: number | null
  cgstAmount?: number | null; sgstAmount?: number | null; igstAmount?: number | null
  shippingAmount?: number | null; discountAmount?: number | null; roundOffAmount?: number | null
  createdAt: string; shippingAddress: Address | null; billingAddress: Address | null
  items: { id: string; quantity: number; unitPrice: number; totalPrice: number; product: { title: string; sku: string | null; hsnCode?: string | null } }[]
  payment: { provider: string; status: string; providerRef: string | null } | null
  user: { firstName: string; lastName: string; email: string; phone: string | null; companyName?: string | null; gstin?: string | null }
}

const money = (value: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
function smallWords(n: number): string { if (n < 20) return ones[n]; if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim(); return `${ones[Math.floor(n / 100)]} Hundred ${smallWords(n % 100)}`.trim() }
function amountInWords(value: number) {
  let n = Math.floor(Math.abs(value)); if (!n) return "Zero Rupees Only"
  const parts: string[] = []; const groups: [number, string][] = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]]
  for (const [size, label] of groups) if (n >= size) { parts.push(`${smallWords(Math.floor(n / size))} ${label}`); n %= size }
  if (n) parts.push(smallWords(n)); return `${parts.join(" ")} Rupees Only`
}

export default function InvoicePage() {
  const params = useParams(); const router = useRouter(); const [order, setOrder] = useState<InvoiceOrder | null>(null); const [loading, setLoading] = useState(true)
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const logoUrl = useSetting("logoUrl", "")
  const sellerAddress = useSetting("businessAddress", "Business address")
  const sellerState = useSetting("businessState", "")
  const sellerGstin = useSetting("businessGstin", "")
  const contactEmail = useSetting("contactEmail", "")
  const contactPhone = useSetting("contactPhone", "")
  const bankName = useSetting("bankName", "")
  const bankAccount = useSetting("bankAccountNumber", "")
  const bankIfsc = useSetting("bankIfsc", "")

  useEffect(() => { const token = localStorage.getItem("token"); if (!token) { router.push("/login"); return }
    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => setOrder(data.order || null)).finally(() => setLoading(false))
  }, [params.id, router])
  if (loading) return <div className="min-h-screen grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-b-primary-600" /></div>
  if (!order) return <div className="min-h-screen grid place-items-center text-center"><div><Package className="mx-auto text-gray-300" size={40}/><p className="mt-3 text-gray-500">Order not found</p><Link href="/orders" className="text-primary-600">Back to orders</Link></div></div>

  const billed = order.billingAddress || order.shippingAddress
  const subtotal = Number(order.subtotal ?? order.items.reduce((s, i) => s + Number(i.totalPrice), 0))
  const tax = Number(order.taxAmount ?? 0), cgst = Number(order.cgstAmount ?? tax / 2), sgst = Number(order.sgstAmount ?? tax / 2), igst = Number(order.igstAmount ?? 0)
  const shipping = Number(order.shippingAmount ?? 0), discount = Number(order.discountAmount ?? 0), roundOff = Number(order.roundOffAmount ?? 0)
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const buyerName = order.user.companyName || `${order.user.firstName} ${order.user.lastName}`
  const addressLines = (a: Address | null) => [a?.street || a?.line1, a?.line2, [a?.city, a?.state, a?.zip || a?.postalCode].filter(Boolean).join(", "), a?.country].filter(Boolean)

  return <main className="min-h-screen bg-slate-100 py-6 text-black print:bg-white print:p-0">
    <style>{`
      .invoice { font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.25; }
      .invoice h1,.invoice h2,.invoice h3 { font-family: Arial, Helvetica, sans-serif; letter-spacing: 0; }
      .rule { border-color:#222; } .cell { border-right:1px solid #222; border-bottom:1px solid #222; }
      @page { size: A4; margin: 8mm; }
      @media print { header,footer,.no-print{display:none!important} body{background:#fff!important}.invoice-sheet{width:194mm!important;min-height:279mm!important;margin:0!important;box-shadow:none!important} }
    `}</style>
    <div className="no-print mx-auto mb-4 flex max-w-[794px] items-center justify-between px-2">
      <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600"><ArrowLeft size={16}/> Back to order</Link>
      <button onClick={() => window.print()} className="btn-primary px-5 py-2.5 text-sm"><Printer size={16}/> Print / Save PDF</button>
    </div>
    <article className="invoice invoice-sheet mx-auto min-h-[1123px] w-[794px] bg-white p-5 shadow-lg">
      <section className="rule grid grid-cols-2 border border-black">
        <div className="cell min-h-[124px] p-1.5">
          <div className="flex gap-3">{logoUrl ? <img src={logoUrl} alt={`${siteName} logo`} className="h-12 w-24 object-contain"/> : <div className="grid h-12 w-24 place-items-center border text-[9px] font-bold">{siteName}</div>}
            <div><h2 className="text-[12px] font-bold">{siteName}</h2><p className="max-w-[250px]">{sellerAddress}</p>{sellerState && <p>State: {sellerState}</p>}{sellerGstin && <p>GSTIN/UIN: <b>{sellerGstin}</b></p>}{contactPhone && <p>Contact: {contactPhone}</p>}{contactEmail && <p>E-Mail: {contactEmail}</p>}</div>
          </div>
        </div>
        <div className="grid grid-cols-2"><div className="cell p-1"><span>Invoice No.</span><b className="block text-[11px]">{order.orderNumber.slice(0, 12).toUpperCase()}</b></div><div className="cell border-r-0 p-1"><span>Dated</span><b className="block text-[11px]">{new Date(order.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" }).replace(/ /g,"-")}</b></div><div className="cell p-1">Terms of Delivery</div><div className="cell border-r-0 p-1">Mode/Terms of Payment<b className="block">{order.payment?.provider || "As Agreed"}</b></div></div>
        <div className="cell min-h-[112px] border-b-0 p-1.5"><span>Buyer (Bill to)</span><h3 className="text-[11px] font-bold">{buyerName}</h3>{addressLines(billed).map((l,i)=><p key={i}>{l}</p>)}{(billed?.gstin || billed?.gstNumber || order.user.gstin) && <p>GSTIN/UIN: <b>{billed?.gstin || billed?.gstNumber || order.user.gstin}</b></p>}<p>Contact: {order.user.phone || "—"}</p><p>E-Mail: {order.user.email}</p></div>
        <div className="min-h-[112px] p-1.5"><span>Consignee (Ship to)</span><h3 className="text-[11px] font-bold">{buyerName}</h3>{addressLines(order.shippingAddress).map((l,i)=><p key={i}>{l}</p>)}</div>
      </section>
      <table className="w-full table-fixed border-collapse border-x border-b border-black text-[9px]"><thead><tr className="h-38 text-center"><th className="w-[4%] border-r border-black py-1 font-normal">Sl.<br/>No.</th><th className="w-[29%] border-r border-black font-normal">Description of Goods</th><th className="w-[10%] border-r border-black font-normal">HSN/SAC</th><th className="w-[10%] border-r border-black font-normal">Quantity</th><th className="w-[11%] border-r border-black font-normal">Rate<br/><span className="text-[8px]">(Incl. of Tax)</span></th><th className="w-[11%] border-r border-black font-normal">Taxable Rate</th><th className="w-[7%] border-r border-black font-normal">per</th><th className="w-[7%] border-r border-black font-normal">Disc. %</th><th className="w-[14%] font-normal">Amount</th></tr></thead>
        <tbody className="border-t border-black align-top">{order.items.map((item,i)=>{ const itemTax = subtotal ? tax * Number(item.totalPrice) / subtotal : 0; const included = Number(item.totalPrice) + itemTax; return <tr key={item.id} className="h-12"><td className="border-r border-black p-1 text-center">{i+1}</td><td className="border-r border-black p-1 font-bold uppercase">{item.product.title}</td><td className="border-r border-black p-1">{item.product.hsnCode || item.product.sku || "—"}</td><td className="border-r border-black p-1 text-center font-bold">{item.quantity} Pcs.</td><td className="border-r border-black p-1 text-right">{money(included/item.quantity)}</td><td className="border-r border-black p-1 text-right">{money(Number(item.unitPrice))}</td><td className="border-r border-black p-1 text-center">Pcs.</td><td className="border-r border-black p-1 text-center">—</td><td className="p-1 text-right font-bold">{money(Number(item.totalPrice))}</td></tr>})}
          <tr className="h-[225px]"><td className="border-r border-black"></td><td className="border-r border-black p-1 text-right font-bold italic"><div className="space-y-2">{discount>0&&<p>Discount</p>}{shipping>0&&<p>Shipping</p>}{cgst>0&&<p>CGST</p>}{sgst>0&&<p>SGST</p>}{igst>0&&<p>IGST</p>}{roundOff!==0&&<p>Rounding Amt</p>}</div></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="p-1 text-right font-bold"><div className="space-y-2">{discount>0&&<p>-{money(discount)}</p>}{shipping>0&&<p>{money(shipping)}</p>}{cgst>0&&<p>{money(cgst)}</p>}{sgst>0&&<p>{money(sgst)}</p>}{igst>0&&<p>{money(igst)}</p>}{roundOff!==0&&<p>{roundOff>0?"":"-"}{money(Math.abs(roundOff))}</p>}</div></td></tr>
        </tbody><tfoot><tr className="border-t border-black"><td></td><td className="border-r border-black p-1 text-right">Total</td><td className="border-r border-black"></td><td className="border-r border-black p-1 text-center font-bold">{totalQty} Pcs.</td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="p-1 text-right text-[12px] font-bold">₹ {money(Number(order.totalAmount))}</td></tr></tfoot></table>
      <section className="border-x border-b border-black p-1"><div className="flex justify-between"><span>Amount Chargeable (in words)</span><span className="italic">E. &amp; O.E</span></div><b>{amountInWords(Number(order.totalAmount))}</b></section>
      <section className="grid min-h-[265px] grid-cols-2 border-x border-b border-black"><div className="flex flex-col justify-between p-1.5"><div><p className="font-bold">Terms &amp; Conditions:</p><ol className="mt-3 list-inside list-decimal space-y-1"><li>Goods once sold will not be taken back.</li><li>Any warranty is provided by the product manufacturer.</li><li>Late payments may attract interest as permitted by law.</li><li>All disputes are subject to the seller&apos;s local jurisdiction.</li></ol></div><p className="text-[8px] uppercase">Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p></div>
        <div className="flex flex-col justify-end"><div className="border-b border-black p-1.5"><p className="font-bold">Company&apos;s Bank Details</p>{bankName?<><p>Bank Name: <b>{bankName}</b></p><p>A/c No.: <b>{bankAccount || "—"}</b></p><p>Branch &amp; IFSC: <b>{bankIfsc || "—"}</b></p></>:<p className="text-gray-500">Configure bank details in site settings.</p>}</div><div className="flex min-h-[74px] flex-col justify-between p-1.5 text-right"><b>for {siteName}</b><span>Authorised Signatory</span></div></div>
      </section><p className="py-1 text-center text-[9px] uppercase">This is a computer-generated invoice</p>
    </article>
  </main>
}
