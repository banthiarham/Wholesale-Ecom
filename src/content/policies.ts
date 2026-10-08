// Text of the About Us / Privacy Policy / Terms / Shipping pages. Copied from the four Word
// documents in "policy ofr whole" (About us, PRIVACY POLICY, Terms and condition, SHIPPING
// INFORMATION); only whitespace and two tiny typos were tidied ("it's life cycle", "Opt - Out") and the run-together shipping paragraph split
// into one line per rule. Edit the wording here — the pages render straight from this file.

export interface PolicySection {
  heading?: string
  paragraphs?: string[]
  /** Bullet list */
  items?: string[]
  /** Numbered list */
  numbered?: string[]
}

export interface PolicyDoc {
  slug: "about" | "privacy" | "terms" | "shipping" | "cancellation" | "returns"
  /** Short label used in navigation / breadcrumbs */
  label: string
  eyebrow: string
  title: string
  description: string
  intro?: string[]
  sections: PolicySection[]
}

export const aboutUs: PolicyDoc = {
  slug: "about",
  label: "About Us",
  eyebrow: "Our Story",
  title: "About Us",
  description:
    "Arham Communication, Hanumangarh — a one-stop distributor of mobile accessories, IT hardware, speakers, CCTV and software, serving partners across India since 2018.",
  intro: [
    "We started our Distribution business as Arham Communication in 2018. We first started with mobile accessories segment and gradually we grew our product range to where we are today. We can now proudly say that we provide a complete Mobile Accessories, IT hardware, Speakers, CCTV, Software solution at one stop.",
  ],
  sections: [
    {
      paragraphs: [
        "We are centrally located in Hanumangarh and have expanded our business all over INDIA. We are serving our satisfied partners for over 4 years now.",
        "To cope up with dynamically changing business environment we are constantly trying to adapt so as to provide our partners with the best business experience. Considering this, we have added our business into online portal which is going to be very resourceful and transparent business platform.",
        "Our aim is to facilitate our partners with easy and quick access to information about the wide range of products at one click and equally easy, convenient and hassle free business experience.",
        "We have grown and reached where we are today because of all the cooperation and support of our partners and we wish the same for the future.",
      ],
    },
  ],
}

export const privacyPolicy: PolicyDoc = {
  slug: "privacy",
  label: "Privacy Policy",
  eyebrow: "Legal",
  title: "Privacy Policy",
  description:
    "How wholesalecenter.in collects, uses, shares and protects your information, including cookies, security, opt-out and consent.",
  intro: [
    "We insist on the highest standards for secure transactions and customer information privacy since we value the trust you place in us.",
    "Our privacy policy is subject to change at any time without prior notice. To make sure you are aware of any changes, please review this policy periodically.",
    "By visiting this website you agree to be bound by the terms and conditions of this Privacy Policy. If you do not agree please do not use or access our Website.",
    "By mere use of the Website, you expressly consent to our use and disclosure of your personal information in accordance with this Privacy Policy. This Privacy Policy is incorporated into and subject to the Terms of Use.",
  ],
  sections: [
    {
      heading: "Collection of Information",
      paragraphs: [
        "When you use our Website, we collect and store your personal information which is provided by you from time to time. We aim to provide you a safe, efficient, smooth and customized experience. This allows us to provide services and features that most likely meet your needs, and to customize our Website to make your experience safer and easier. More importantly, while doing so we collect personal information from you that we consider necessary for achieving this purpose.",
        "In general, you can browse the Website without revealing your identity or any personal information about yourself. Once you give us your personal information, you are not anonymous to us. Wherever possible, we indicate which fields are optional and which are required. You always have the option to not provide information by choosing not to use a particular service or feature on the Website. We may automatically track certain information about you based upon your behaviour on our Website. We use this information to do internal research on our user's demographics, interests, and behaviour to better understand, protect and serve our users. This information is compiled and analysed on an aggregated basis. This information may include the URL that you just came from (whether this URL is on our Website or not), which URL you next go to (whether this URL is on our Website or not), your computer browser information, and your IP address.",
        "We use data collection devices such as \"cookies\" on certain pages of the Website to help analyse our web page flow, measure promotional effectiveness, and promote trust and safety. \"Cookies\" are small identifiers sent from a web server and stored on your computer's hard drive, that help us to recognize you if you visit our website again.",
        "Additionally, you may encounter \"cookies\" or other similar devices on certain pages of the Website that are placed by third parties. We do not control the use of cookies by third parties.",
        "We collect information about your buying behaviour if you choose to buy on the Website.",
        "In case you transact with us, we collect certain additional information, such as a billing address, credit / debit card number, expiration date, other payment details and tracking information from money orders and cheques.",
        "In case you choose to post messages on our chat rooms, message boards or other message areas or leave feedback, we will collect that information you provide to us. We retain this information as necessary to resolve disputes, provide customer support and troubleshoot problems as permitted by law.",
        "In case you send us personal correspondence, such as emails or letters, or if other users or third parties send us correspondence about your activities or postings on the Website, we may collect such information into a file specific to you.",
        "We collect personally identifiable information (email address, name, phone number, credit card / debit card / other payment instrument details, etc.) when you set up a free account with us.",
      ],
    },
    {
      heading: "Use and Sharing of Information",
      paragraphs: [
        "At no time will we sell your personally-identifiable data without your permission unless set forth in this Privacy Policy. The information we receive about you or from you may be used by us or shared by us with our corporate affiliates, dealers, agents, vendors and other third parties to help process your request; to comply with any law, regulation, audit or court order; to help improve our website or the products or services we offer; for research; to better understand our customer's needs; to develop new offerings; and to alert you to new products and services (of us or our business associates) in which you may be interested. We may also combine information you provide us with information about you that is available to us internally or from other sources in order to better serve you.",
        "We do not share, sell, trade or rent your personal information to third parties for unknown reasons.",
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "\"Cookies\" are small identifiers sent from a web server and stored on your computer's hard drive, that help us to recognize you if you visit our website again.",
        "From time to time, we may place \"cookies\" on your personal computer. Also, our site uses cookies to track how you found our site. To protect your privacy we do not use cookies to store or transmit any personal information about you on the Internet. You have the ability to accept or decline cookies. Most web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. If you choose to decline cookies certain features of the site may not function properly or at all as a result.",
      ],
    },
    {
      heading: "Links",
      paragraphs: [
        "Our website contains links to other sites. Such other sites may use information about your visit to this website. Our Privacy Policy does not apply to practices of such sites that we do not own or control or to people we do not employ. Therefore, we are not responsible for the privacy practices or the accuracy or the integrity of the content included on such other sites. We encourage you to read the individual privacy statements of such websites.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "We safeguard your privacy using known security standards and procedures and comply with applicable privacy laws. Our websites combine industry-approved physical, electronic and procedural safeguards to ensure that your information is well protected throughout its life cycle in our infrastructure.",
        "Sensitive data is hashed or encrypted when it is stored in our infrastructure. Sensitive data is decrypted, processed and immediately re-encrypted or discarded when no longer necessary. We host web services in audited data centers, with restricted access to the data processing servers. Controlled access, recorded and live-monitored video feeds, 24/7 staffed security and biometrics provided in such data centers ensure that we provide secure hosting.",
      ],
    },
    {
      heading: "Opt-Out Policy",
      paragraphs: [
        "All our users have the opportunity to opt-out of receiving non-essential (promotional, marketing-related) communications.",
        "Please email at contact@wholesalecenter.in if you no longer wish to receive any information from us.",
      ],
    },
    {
      heading: "Consent",
      paragraphs: [
        "By using the Website and/or by providing your information, you consent to the collection and use of the information you disclose on the Website in accordance with this Privacy Policy, including but not limited to Your consent for sharing your information as per this privacy policy.",
        "If we decide to change our privacy policy, we will post those changes on this page so that you are always aware of what information we collect, how we use it, and under what circumstances we disclose it.",
      ],
    },
    {
      heading: "Changes to this Privacy Policy",
      paragraphs: [
        "Our privacy policy is subject to change at any time without notice. We may change our Privacy Policy from time to time. Please review this policy periodically to make sure you are aware of any changes.",
      ],
    },
    {
      heading: "Questions",
      paragraphs: [
        "If you have any questions about our Privacy Policy, please e-mail your questions to us at contact@wholesalecenter.in",
      ],
    },
  ],
}

export const termsAndConditions: PolicyDoc = {
  slug: "terms",
  label: "Terms of Service",
  eyebrow: "Legal",
  title: "Terms & Conditions",
  description:
    "The terms of the agreement between you and Arham Communication, Hanumangarh for using wholesalecenter.in — pricing, orders, warranty, returns and shipping.",
  intro: [
    "Please read this document carefully.",
    "This is legal agreement between you and Arham Communication, Hanumangarh.",
    "By joining, you are agreeing to become bound by the terms of this agreement.",
  ],
  sections: [
    {
      numbered: [
        "We reserve the right to make changes to the products and prices listed on www.wholesalecenter.in, and to other content of this website at any time without prior notice.",
        "While we do our best to ensure that product information on our website is accurate, some inaccuracies, typographical errors or misinterpretations may occur. We reserve the right to correct such inaccuracies or typographical errors as they are identified.",
        "Image of the product may vary from the actual product.",
        "Before placing order please check all information about product from manufacturer's website.",
        "Warranties are limited on all items. Please check manufacturer's website to verify the warranty.",
        "Prices shown on the website www.wholesalecenter.in are in Indian Rupees and are inclusive of taxes.",
        "We do not offer any type of price protection in any product. In our product line prices fluctuate frequently.",
        "All orders are executed after payment realization in favour of Arham Communication, Hanumangarh.",
        "All products have their minimum and maximum order quantity limits.",
        "All product carry manufacturer's warranty. Within warranty period defective product must be send to manufacturer or their authorized service provider. Details of service provider are located below the home page. We are not responsible for any warranty.",
        "Any product which is dead on arrival (DOA) must be send to us within 10 days from billing date.",
        "All sales are final. Returns are not allowed after 7 days of billing. Returned product must be in good condition and fully packed. Mishandled product shall not be accepted.",
        "If you return On-order category product, you will be charged 10% restocking fee.",
        "Arham Communication, Hanumangarh cannot warrant the compatibility of any product for any particular use or purpose. We strongly recommend you to evaluate whether a product will be compatible or not with the given configuration.",
        "All prices are quoted ex-warehouse Hanumangarh.",
        "Freight on every shipment will be charged, which will be mentioned on the checkout screen after selecting your shipment method.",
        "We encourage all partners to thoroughly review their order, shipping & billing information.",
        "We do not ensure to dispatch your order in the same day if your order is placed after 4 pm.",
        "You will receive a confirmation email once your order is shipped.",
        "We are using standard shipping companies with tracking number.",
        "Freight is charged on every shipment on the basis of distance & number of parcels.",
        "Shipment through transport will be send on To Pay basis.",
        "If there is a problem in delivery, please contact the courier directly prior to contacting us.",
      ],
    },
  ],
}

export const shippingInformation: PolicyDoc = {
  slug: "shipping",
  label: "Shipping Policy",
  eyebrow: "Delivery",
  title: "Shipping Information",
  description:
    "How orders are dispatched and shipped from wholesalecenter.in — dispatch cut-off, tracking, freight charges and To Pay transport shipments.",
  sections: [
    {
      items: [
        "We encourage all partners to thoroughly review their order, shipping & billing information before placing order.",
        "We do not ensure to dispatch your order after 4.00 pm in a working day.",
        "You will receive a confirmation email once your order is shipped.",
        "We are using standard shipping companies with tracking number.",
        "Freight is charged on every shipment on the basis of distance & number of parcels.",
        "Shipment through transport will be on To Pay basis.",
        "If there is a problem in delivery, please contact the courier directly prior to contacting us.",
      ],
    },
  ],
}

export const cancellationPolicy: PolicyDoc = {
  slug: "cancellation",
  label: "Cancellation Policy",
  eyebrow: "Orders",
  title: "Cancellation Policy",
  description:
    "How to request cancellation of an order placed on wholesalecenter.in, and how cancellations relate to payment and returns.",
  intro: [
    "This Cancellation Policy applies to orders placed through www.wholesalecenter.in and should be read together with the website Terms and Conditions and Shipping Information.",
  ],
  sections: [
    {
      heading: "1. Cancellation of Orders",
      paragraphs: [
        "Customers may request cancellation of an order as early as possible after placing the order. Because orders are executed after payment realization in favour of Arham Communication, cancellation requests are subject to the status of the order at the time the request is received.",
      ],
      items: [
        "A cancellation request should be submitted before the order has been processed for dispatch, wherever possible.",
        "Once an order has been processed or dispatched, cancellation may no longer be possible and the matter may be treated under the applicable return terms.",
        "Customers are encouraged to review product, order, shipping and billing information carefully before placing an order.",
      ],
    },
    {
      heading: "2. How to Request Cancellation",
      paragraphs: [
        "To request cancellation, contact us at contact@wholesalecenter.in with the order reference, customer name, registered contact details and the reason for cancellation. The request will be reviewed against the current order status.",
      ],
    },
    {
      heading: "3. Cancellation and Payment",
      paragraphs: [
        "All orders are executed after payment realization. Where a cancellation is accepted, any applicable payment reversal or adjustment will be handled based on the order status and the applicable terms of the transaction.",
        "A cancellation request does not automatically confirm a refund. Confirmation of the cancellation and any resulting payment adjustment will be communicated after the order has been reviewed.",
      ],
    },
    {
      heading: "4. On-Order Products",
      paragraphs: [
        "Certain products may be supplied on an on-order basis. Customers should carefully consider such products before placing an order. The existing Terms and Conditions state that a returned On-order category product is subject to a 10% restocking fee. This provision applies to returns of such products and is separate from the initial submission of a cancellation request.",
      ],
    },
    {
      heading: "5. Important Order Conditions",
      items: [
        "Product prices can change frequently and the website does not provide price protection.",
        "Products may have minimum and maximum order quantity limits.",
        "Product images may vary from the actual product, and customers are encouraged to verify product information from the manufacturer before ordering.",
        "For warranty-related matters, manufacturer warranty terms and authorised service procedures continue to apply.",
      ],
    },
    {
      heading: "6. Policy Changes",
      paragraphs: [
        "We may update this policy from time to time. The latest version published on www.wholesalecenter.in will apply to future requests, subject to applicable order terms.",
      ],
    },
    {
      heading: "Questions or requests",
      paragraphs: [
        "Please contact us at contact@wholesalecenter.in. Include your order details and the reason for the request so that we can review the matter efficiently.",
      ],
    },
  ],
}

export const returnsPolicy: PolicyDoc = {
  slug: "returns",
  label: "Returns & Refunds",
  eyebrow: "Returns",
  title: "Returns and Refunds Policy",
  description:
    "Return, Dead-on-Arrival (DOA), warranty and refund terms for orders placed on wholesalecenter.in.",
  intro: [
    "This Returns and Refunds Policy reflects the existing wholesale sales and warranty terms of Arham Communication and should be read together with the website Terms and Conditions and Shipping Information.",
  ],
  sections: [
    {
      heading: "1. General Return Policy",
      paragraphs: [
        "All sales are final. As stated in the existing Terms and Conditions, returns are not allowed after 7 days from the billing date. Customers should inspect products promptly after delivery and raise any eligible issue within the applicable period.",
      ],
    },
    {
      heading: "2. Dead on Arrival (DOA)",
      paragraphs: [
        "Any product that is dead on arrival (DOA) must be sent to us within 10 days from the billing date. The customer should contact us promptly so that the case can be reviewed and the appropriate next step can be communicated.",
      ],
      items: [
        "The DOA provision is separate from the general 7-day return restriction stated in the Terms and Conditions.",
        "The product should be returned with its applicable packaging and accessories so that the case can be evaluated.",
      ],
    },
    {
      heading: "3. Condition of Returned Products",
      paragraphs: [
        "To be considered for return, the product must be in good condition and fully packed. Mishandled products will not be accepted.",
      ],
      items: [
        "Keep the original product packaging, accessories and related contents until the issue has been resolved.",
        "Damage caused by mishandling is not eligible for acceptance under the existing return terms.",
      ],
    },
    {
      heading: "4. Manufacturer Warranty",
      paragraphs: [
        "All products carry manufacturer warranty as stated in the Terms and Conditions. Within the warranty period, a defective product must be sent to the manufacturer or its authorised service provider. Arham Communication is not responsible for providing the manufacturer warranty itself.",
        "Customers should check the manufacturer website for warranty coverage, service-centre details and the applicable warranty procedure before raising a warranty-related request.",
      ],
    },
    {
      heading: "5. On-Order Category Products",
      paragraphs: [
        "If an On-order category product is returned, the existing Terms and Conditions provide for a 10% restocking fee. This fee is applicable to the return of an On-order category product and should be considered before requesting a return.",
      ],
    },
    {
      heading: "6. Refunds and Order Adjustments",
      paragraphs: [
        "Where a return is accepted after review, any applicable refund or order adjustment will be determined based on the reason for return, the condition of the product and the applicable order terms. Customers will be informed of the outcome after the returned product or claim has been evaluated.",
        "This policy does not create a general right to return products beyond the return, DOA and warranty provisions described above.",
      ],
    },
    {
      heading: "7. How to Raise a Return or Refund Request",
      paragraphs: [
        "Contact contact@wholesalecenter.in with your order reference, billing details, product name, date of billing and a clear description of the issue. Where relevant, provide supporting photographs or other information that helps us assess the condition of the product.",
      ],
    },
    {
      heading: "8. Shipping and Delivery Considerations",
      paragraphs: [
        "Customers are encouraged to review order, shipping and billing information carefully before placing an order. Orders are shipped through standard shipping companies with tracking numbers, freight is charged on each shipment based on distance and number of parcels, and transport shipments are sent on a To Pay basis. Delivery issues should first be raised with the courier directly before contacting us.",
      ],
    },
    {
      heading: "9. Policy Changes",
      paragraphs: [
        "We may update this policy from time to time. Customers should review the latest version published on www.wholesalecenter.in.",
      ],
    },
    {
      heading: "Questions or requests",
      paragraphs: [
        "Please contact us at contact@wholesalecenter.in. Include your order details and the reason for the request so that we can review the matter efficiently.",
      ],
    },
  ],
}

export const policyDocs: PolicyDoc[] = [aboutUs, privacyPolicy, termsAndConditions, shippingInformation, returnsPolicy, cancellationPolicy]
