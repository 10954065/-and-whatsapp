import type { AiTone, Industry } from "@/generated/prisma/enums";

export interface IndustryTemplate {
  /** Suggested knowledge-profile fields shown during onboarding. */
  knowledgeFields: { key: string; label: string; placeholder: string }[];
  defaultTone: AiTone;
  roleDescription: string;
  /** Guidance appended to the shared agent prompt. */
  aiGuidance: string;
  commonQuestions: string[];
  escalationRules: string[];
  /** Tools that are enabled by default for this industry. */
  suggestedTools: string[];
  /** Workflow template ids offered in the automation studio. */
  suggestedWorkflows: string[];
  onboardingTips: string[];
}

const BASE_TOOLS = ["search_knowledge", "get_business_info", "escalate_to_human", "capture_lead", "create_follow_up"];
const COMMERCE_TOOLS = ["get_product_info", "check_stock", "create_order", "get_order_status"];
const BOOKING_TOOLS = ["check_availability", "create_booking"];

export const INDUSTRY_TEMPLATES: Record<Industry, IndustryTemplate> = {
  RESTAURANT: {
    knowledgeFields: [
      { key: "menu_highlights", label: "Menu highlights", placeholder: "Jollof rice with chicken, banku and tilapia, kelewele…" },
      { key: "delivery_areas", label: "Delivery areas & fees", placeholder: "East Legon GH₵15, Osu GH₵20…" },
      { key: "dietary", label: "Dietary options", placeholder: "Vegetarian dishes, halal, no-pork kitchen…" },
    ],
    defaultTone: "WARM",
    roleDescription: "Takes food orders, answers menu questions and handles reservations.",
    aiGuidance:
      "Help customers choose dishes and place orders. Confirm item, quantity, delivery or pick-up, address and preferred time before creating an order. Always check availability with tools; dishes can sell out. Mention allergens only when they are documented.",
    commonQuestions: ["What's on the menu today?", "Do you deliver to my area?", "How long will delivery take?", "Can I book a table for six?"],
    escalationRules: ["a customer reports food safety or allergy problems", "an order is late or wrong", "large catering or event orders"],
    suggestedTools: [...BASE_TOOLS, ...COMMERCE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["order_payment_reminder", "new_lead_notify"],
    onboardingTips: ["Add each dish as a product with its price so the AI can quote accurately.", "List delivery areas and fees in the knowledge base."],
  },
  RETAIL: {
    knowledgeFields: [
      { key: "categories", label: "What you sell", placeholder: "Phones, accessories, home appliances…" },
      { key: "delivery", label: "Delivery & pick-up", placeholder: "Same-day delivery in Accra…" },
      { key: "returns", label: "Returns & warranty", placeholder: "7-day returns with receipt…" },
    ],
    defaultTone: "FRIENDLY",
    roleDescription: "Answers product questions, checks stock and takes orders.",
    aiGuidance:
      "Recommend products from the catalogue that match the customer's need. Always check stock and price with tools before quoting. Confirm variant, quantity and delivery details before creating an order.",
    commonQuestions: ["Do you have this in stock?", "How much is it?", "Do you deliver?", "Can I pay with MoMo?"],
    escalationRules: ["warranty claims or faulty products", "bulk or wholesale pricing requests"],
    suggestedTools: [...BASE_TOOLS, ...COMMERCE_TOOLS],
    suggestedWorkflows: ["order_payment_reminder", "new_lead_notify", "low_stock_alert"],
    onboardingTips: ["Import your catalogue with SKUs and stock levels.", "Write your returns policy in the knowledge base."],
  },
  FASHION: {
    knowledgeFields: [
      { key: "collections", label: "Collections", placeholder: "Kente prints, ready-to-wear, bespoke tailoring…" },
      { key: "sizing", label: "Size guide", placeholder: "S: 34–36 chest, M: 38–40…" },
      { key: "custom_orders", label: "Custom orders", placeholder: "Bespoke takes 10 working days…" },
    ],
    defaultTone: "PLAYFUL",
    roleDescription: "Helps customers find styles and sizes, and takes orders.",
    aiGuidance:
      "Help with styles, sizing and availability. Use the size guide from knowledge; never guess fit. Check stock per size and colour before confirming. Custom measurements and alterations go to staff.",
    commonQuestions: ["Do you have this in size M?", "What colours are available?", "How long do custom orders take?"],
    escalationRules: ["custom tailoring or measurements", "exchanges for size"],
    suggestedTools: [...BASE_TOOLS, ...COMMERCE_TOOLS],
    suggestedWorkflows: ["order_payment_reminder", "new_lead_notify"],
    onboardingTips: ["Create one product per style with a variant per size/colour.", "Add your size guide to the knowledge base."],
  },
  BEAUTY: {
    knowledgeFields: [
      { key: "products", label: "Product range", placeholder: "Shea butter, black soap, serums…" },
      { key: "skin_types", label: "Skin and hair types served", placeholder: "Dry, oily, natural hair…" },
      { key: "ingredients", label: "Key ingredients", placeholder: "Organic shea, no parabens…" },
    ],
    defaultTone: "WARM",
    roleDescription: "Recommends beauty products and takes orders.",
    aiGuidance:
      "Recommend products using documented descriptions and ingredients only. Never make medical or dermatological claims or treat skin conditions; suggest a professional for persistent issues.",
    commonQuestions: ["Which product is best for dry skin?", "Is it safe for sensitive skin?", "How do I use it?"],
    escalationRules: ["reactions, rashes or medical concerns", "wholesale enquiries"],
    suggestedTools: [...BASE_TOOLS, ...COMMERCE_TOOLS],
    suggestedWorkflows: ["order_payment_reminder", "new_lead_notify"],
    onboardingTips: ["Add usage instructions to each product description."],
  },
  SALON_SPA: {
    knowledgeFields: [
      { key: "services", label: "Services", placeholder: "Box braids, manicure, deep-tissue massage…" },
      { key: "preparation", label: "Before your appointment", placeholder: "Come with washed hair…" },
      { key: "cancellation", label: "Cancellation policy", placeholder: "24 hours' notice please…" },
    ],
    defaultTone: "FRIENDLY",
    roleDescription: "Books appointments and answers service questions.",
    aiGuidance:
      "Help customers choose a service and book a time. Always check real availability with tools before offering a slot, and confirm service, stylist, date and time before booking.",
    commonQuestions: ["Do you have a slot on Saturday?", "How long do knotless braids take?", "How much is a pedicure?"],
    escalationRules: ["complaints about a service", "group or bridal bookings"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["booking_reminder", "new_lead_notify"],
    onboardingTips: ["Add services with durations and buffers, then each stylist's working hours."],
  },
  HEALTHCARE_ADMIN: {
    knowledgeFields: [
      { key: "departments", label: "Departments & services", placeholder: "General consultation, laboratory, dental…" },
      { key: "insurance", label: "Insurance accepted", placeholder: "NHIS, private insurers…" },
      { key: "visiting", label: "Visiting & preparation", placeholder: "Fast 8 hours before blood tests…" },
    ],
    defaultTone: "PROFESSIONAL",
    roleDescription: "Front-desk assistant for appointments and administrative questions only.",
    aiGuidance:
      "You are an administrative assistant only. Never diagnose, interpret symptoms, recommend medicines or doses, or give medical opinions. For any clinical question, explain that a clinician must advise and offer an appointment. If someone describes an emergency, tell them to call 112 or go to the nearest emergency department immediately and escalate.",
    commonQuestions: ["What time do you open?", "Can I book an appointment?", "Do you accept NHIS?"],
    escalationRules: ["any symptom, emergency or clinical question", "test results or medical records requests"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["booking_reminder"],
    onboardingTips: ["Keep clinical content out of the knowledge base; add administrative information only."],
  },
  HOSPITALITY: {
    knowledgeFields: [
      { key: "rooms", label: "Room types", placeholder: "Standard, deluxe, suite…" },
      { key: "amenities", label: "Amenities", placeholder: "Pool, Wi-Fi, airport shuttle…" },
      { key: "policies", label: "Check-in & policies", placeholder: "Check-in 14:00, check-out 11:00…" },
    ],
    defaultTone: "PROFESSIONAL",
    roleDescription: "Answers guest questions and captures booking enquiries.",
    aiGuidance:
      "Answer questions about rooms, amenities and policies from knowledge. Room availability and rates must come from tools or staff — capture the dates and guest count as a lead and escalate if you cannot confirm.",
    commonQuestions: ["Do you have a room for two nights next weekend?", "Is breakfast included?", "Do you offer airport pick-up?"],
    escalationRules: ["group bookings or events", "complaints during a stay"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["new_lead_notify", "booking_reminder"],
    onboardingTips: ["Model room types as services if you take bookings through SUNLEON AI."],
  },
  REAL_ESTATE: {
    knowledgeFields: [
      { key: "listings", label: "Current listings", placeholder: "2-bed apartment, Cantonments, GH₵…/month…" },
      { key: "areas", label: "Areas covered", placeholder: "East Legon, Airport Residential…" },
      { key: "process", label: "Viewing & rental process", placeholder: "Viewing fee, deposit requirements…" },
    ],
    defaultTone: "PROFESSIONAL",
    roleDescription: "Qualifies property leads and books viewings.",
    aiGuidance:
      "Qualify enquiries: budget, area, size, move-in date and rent or buy. Only describe listings documented in knowledge. Capture a lead for every serious enquiry and book viewings when availability tools allow.",
    commonQuestions: ["Is the apartment still available?", "What's the rent?", "Can I view it this week?"],
    escalationRules: ["price negotiation", "legal or title questions"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["new_lead_notify", "follow_up_due"],
    onboardingTips: ["Add each listing to the knowledge base with price and status."],
  },
  EDUCATION: {
    knowledgeFields: [
      { key: "programmes", label: "Programmes & courses", placeholder: "Web development bootcamp, 12 weeks…" },
      { key: "admissions", label: "Admissions", placeholder: "Requirements, deadlines, fees…" },
      { key: "schedule", label: "Schedule", placeholder: "Weekday evenings, Saturday classes…" },
    ],
    defaultTone: "FRIENDLY",
    roleDescription: "Answers admissions questions and captures applicant leads.",
    aiGuidance: "Answer programme and admissions questions from knowledge. Capture interested applicants as leads with their programme of interest.",
    commonQuestions: ["When does the next cohort start?", "How much are the fees?", "Do you offer instalment payments?"],
    escalationRules: ["scholarship or fee waiver requests", "complaints about a course"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["new_lead_notify", "follow_up_due"],
    onboardingTips: ["Add deadlines and fees for every programme."],
  },
  PROFESSIONAL_SERVICES: {
    knowledgeFields: [
      { key: "services", label: "Services", placeholder: "Company registration, tax filing, audits…" },
      { key: "pricing", label: "Pricing approach", placeholder: "Fixed fees for registration, quotes for audits…" },
      { key: "process", label: "How you work", placeholder: "Free 15-minute consultation…" },
    ],
    defaultTone: "PROFESSIONAL",
    roleDescription: "Qualifies enquiries and books consultations.",
    aiGuidance:
      "Explain services and the process from knowledge. Never give legal, tax or financial advice for a specific situation; book a consultation instead. Capture leads with the service needed.",
    commonQuestions: ["How much do you charge?", "How long does registration take?", "Can I book a consultation?"],
    escalationRules: ["requests for specific legal or tax advice", "urgent deadlines"],
    suggestedTools: [...BASE_TOOLS, ...BOOKING_TOOLS],
    suggestedWorkflows: ["new_lead_notify", "follow_up_due"],
    onboardingTips: ["Model consultations as a service with a duration."],
  },
  GENERAL: {
    knowledgeFields: [
      { key: "offer", label: "What you offer", placeholder: "Products or services…" },
      { key: "faqs", label: "Frequent questions", placeholder: "Delivery, payment, hours…" },
    ],
    defaultTone: "FRIENDLY",
    roleDescription: "Answers customer questions and captures leads.",
    aiGuidance: "Answer questions from the business facts and knowledge base, capture interested customers as leads and escalate anything you cannot answer.",
    commonQuestions: ["Are you open today?", "How can I order?", "Where are you located?"],
    escalationRules: ["anything not covered by the knowledge base"],
    suggestedTools: BASE_TOOLS,
    suggestedWorkflows: ["new_lead_notify"],
    onboardingTips: ["Start with your ten most common customer questions as FAQs."],
  },
};
