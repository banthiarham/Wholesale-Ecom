/**
 * Indian address utilities — states/UTs list and PIN code lookup.
 * Uses the free India Post API (https://api.postalpincode.in) for auto-fill.
 */

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

export interface PincodeLocation {
  name: string       // Specific post office / locality name (e.g., "Bazargate", "Mumbai GPO")
  district: string   // District name (e.g., "Mumbai")
  state: string      // State name matched to INDIAN_STATES (e.g., "Maharashtra")
  block: string      // Block / Taluka (e.g., "Mumbai")
}

export interface PincodeResult {
  state: string
  district: string
  locations: PincodeLocation[]  // All specific localities under this PIN code
}

/**
 * Look up an Indian PIN code and return all specific localities.
 * Uses the free India Post API. Returns null on failure.
 */
export async function lookupPincode(pincode: string): Promise<PincodeResult | null> {
  if (!/^\d{6}$/.test(pincode)) return null

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data[0]?.Status !== "Success" || !Array.isArray(data[0]?.PostOffice)) {
      return null
    }

    const postOffices = data[0].PostOffice
    if (postOffices.length === 0) return null

    // Derive common state and district from the first entry
    const first = postOffices[0]
    const rawState = (first.State || "").trim()
    const matchedState = INDIAN_STATES.find(
      (s) => s.toLowerCase() === rawState.toLowerCase()
    ) || rawState
    const district = (first.District || "").trim()

    // Build the list of all specific localities
    const locations: PincodeLocation[] = postOffices.map((po: any) => ({
      name: (po.Name || "").trim(),
      district: (po.District || "").trim(),
      state: matchedState,
      block: (po.Block || "").trim(),
    }))

    return { state: matchedState, district, locations }
  } catch {
    return null
  }
}