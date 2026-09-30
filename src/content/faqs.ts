// FAQs shown on /faq. Answers are based on the Terms & Conditions and Shipping Information
// documents (src/content/policies.ts) and on how the site works — keep them in step with those
// pages when a policy changes.

export interface FaqItem {
  q: string
  a: string
}

export interface FaqGroup {
  title: string
  items: FaqItem[]
}

export const faqGroups: FaqGroup[] = [
  {
    title: "Ordering & Pricing",
    items: [
      {
        q: "Who can buy from wholesalecenter.in?",
        a: "We are a B2B wholesale platform run by Arham Communication, Hanumangarh. Customers can sign up and shop right away, and dealers / businesses can register through the Dealer / B2B form, which is subject to admin approval.",
      },
      {
        q: "What is the minimum order quantity (MOQ)?",
        a: "Every product has its own minimum and maximum order quantity limits, shown on the product page. If your account has a wholesale price for a product, the product page also shows the quantity you need to reach to get that price.",
      },
      {
        q: "Why do I see a different price from another buyer?",
        a: "Wholesale prices can depend on your account type. Your wholesale price is shown under the product name together with its minimum quantity, for example \"Min quantity - 15\".",
      },
      {
        q: "What happens if I order less than the minimum quantity for my wholesale price?",
        a: "You can still order, but the items are billed at the normal (retail) price until you reach the minimum quantity. Your cart and checkout tell you how many units to buy to get the wholesale price.",
      },
      {
        q: "Are the prices inclusive of tax?",
        a: "Yes. Prices on the website are in Indian Rupees and are inclusive of taxes.",
      },
      {
        q: "Do prices change? Is there price protection?",
        a: "Prices fluctuate frequently in our product line and we do not offer price protection on any product. We may change products and prices at any time without prior notice, so please check the price at the time of ordering.",
      },
      {
        q: "The product looks different from the picture. Is that normal?",
        a: "Product images may vary from the actual product. Before placing an order, please also check the product details on the manufacturer's website.",
      },
    ],
  },
  {
    title: "Payment",
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "The payment options available for your order are shown at checkout. Please note that, as per our Terms & Conditions, all orders are executed after payment realization in favour of Arham Communication, Hanumangarh.",
      },
      {
        q: "When is my order processed?",
        a: "Orders are executed once the payment has been realized. You will receive a confirmation email when your order is shipped.",
      },
    ],
  },
  {
    title: "Shipping & Delivery",
    items: [
      {
        q: "How is my order shipped and can I track it?",
        a: "We use standard shipping companies and every shipment has a tracking number. You will receive a confirmation email once your order is shipped.",
      },
      {
        q: "How much is the shipping charge?",
        a: "Freight is charged on every shipment on the basis of distance and number of parcels. The amount is shown on the checkout screen after you select your shipment method.",
      },
      {
        q: "Until what time are orders dispatched?",
        a: "We do not ensure dispatch on the same day for orders placed after 4:00 pm on a working day.",
      },
      {
        q: "What does \"To Pay\" shipment mean?",
        a: "Shipments sent through a transport company go on a To Pay basis, which means the freight is paid on delivery. All prices are quoted ex-warehouse Hanumangarh.",
      },
      {
        q: "My order has a delivery problem. Who should I contact?",
        a: "Please contact the courier directly first. If the issue is still not resolved, get in touch with us through the Contact Us page.",
      },
      {
        q: "Should I check my details before ordering?",
        a: "Yes. Please review your order, shipping and billing information carefully before placing the order.",
      },
    ],
  },
  {
    title: "Returns, Warranty & Support",
    items: [
      {
        q: "What is your return policy?",
        a: "All sales are final and returns are not allowed after 7 days of billing. A returned product must be in good condition and fully packed; mishandled products are not accepted.",
      },
      {
        q: "Is there any charge for returning a product?",
        a: "If you return an On-order category product, a 10% restocking fee is charged.",
      },
      {
        q: "What if a product is dead on arrival (DOA)?",
        a: "A dead-on-arrival product must be sent to us within 10 days from the billing date.",
      },
      {
        q: "How does warranty work?",
        a: "Products carry the manufacturer's warranty. During the warranty period a defective product must be sent to the manufacturer or their authorized service provider, and we are not responsible for warranty. Details of service providers are located below the home page.",
      },
      {
        q: "Will the product work with my setup?",
        a: "We cannot warrant the compatibility of any product for a particular use or purpose, so we strongly recommend checking that a product is compatible with your configuration before ordering.",
      },
      {
        q: "How can I contact you?",
        a: "Call +91 80942 33944 or email arhamcommunication.hmh@gmail.com. You can also use the Contact Us page.",
      },
    ],
  },
]
