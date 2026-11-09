/**
 * Illustrative conversations for the marketing site. They show the product's behaviour
 * (stock checked before quoting, payment confirmed only after Paystack verifies it,
 * hand-over to a person) and are labelled as examples wherever they appear.
 */
export type ChatStep =
  | { kind: "customer"; text: string; time: string }
  | { kind: "business"; text: string; time: string }
  | { kind: "link"; title: string; subtitle: string; time: string }
  | { kind: "action"; title: string; detail: string };

export type ChatChannel = "whatsapp" | "instagram";

export interface ChatScript {
  id: string;
  channel: ChatChannel;
  business: { name: string; handle: string; initials: string };
  customerName: string;
  summary: string;
  steps: ChatStep[];
}

export const HERO_SCRIPTS: ChatScript[] = [
  {
    id: "boutique-order",
    channel: "whatsapp",
    business: { name: "Adwoa's Closet", handle: "Adwoa's Closet", initials: "AC" },
    customerName: "Efua",
    summary: "A customer orders a dress on WhatsApp and pays with mobile money.",
    steps: [
      { kind: "customer", text: "Hello, please do you have the kente midi dress in size M?", time: "09:41" },
      { kind: "action", title: "Checked stock", detail: "Kente midi dress, size M: 3 left" },
      { kind: "business", text: "Hi Efua! Yes, we have 3 left in size M. It's GH₵ 450.", time: "09:41" },
      { kind: "customer", text: "Nice. Can you deliver to Osu today?", time: "09:42" },
      { kind: "business", text: "Yes. Same-day delivery to Osu is GH₵ 30 if you order before 3pm. Shall I reserve one for you?", time: "09:42" },
      { kind: "customer", text: "Yes please 🙏🏾", time: "09:43" },
      { kind: "action", title: "Order #1042 created", detail: "GH₵ 480 · awaiting payment" },
      { kind: "business", text: "Done! Order #1042 is reserved for you. You can pay with MoMo or card here:", time: "09:43" },
      { kind: "link", title: "Pay GH₵ 480.00", subtitle: "Secure checkout by Paystack", time: "09:43" },
      { kind: "action", title: "Payment verified", detail: "Paystack confirmed GH₵ 480 · MoMo" },
      { kind: "business", text: "Payment received, thank you! Your dress goes out with our 4pm delivery.", time: "09:47" },
    ],
  },
  {
    id: "salon-booking",
    channel: "instagram",
    business: { name: "Glow by Esi", handle: "glow.by.esi", initials: "GE" },
    customerName: "Abena",
    summary: "A customer books a braiding appointment through Instagram messages.",
    steps: [
      { kind: "customer", text: "Hi! How much for knotless braids, medium length?", time: "14:05" },
      { kind: "business", text: "Hi Abena! Medium knotless braids are GH₵ 350 and take about 5 hours. Would you like to book?", time: "14:05" },
      { kind: "customer", text: "Do you have Saturday morning?", time: "14:06" },
      { kind: "action", title: "Checked availability", detail: "Saturday 9:00 with Esi is free" },
      { kind: "business", text: "Saturday at 9:00 with Esi is free. Shall I book it for you?", time: "14:06" },
      { kind: "customer", text: "Yes, book me 😍", time: "14:07" },
      { kind: "action", title: "Booking confirmed", detail: "Knotless braids · Sat 9:00 · Esi" },
      { kind: "business", text: "You're booked for Saturday at 9:00 with Esi. I'll send you a reminder on Friday evening.", time: "14:07" },
      { kind: "action", title: "Reminder scheduled", detail: "Friday 18:00 by Instagram message" },
    ],
  },
];

export const HANDOVER_SCRIPT: ChatScript = {
  id: "hardware-handover",
  channel: "whatsapp",
  business: { name: "Kwame Tools & Hardware", handle: "Kwame Tools & Hardware", initials: "KT" },
  customerName: "Yaw",
  summary: "A refund request is handed to a person instead of being answered automatically.",
  steps: [
    { kind: "customer", text: "The drill I bought on Monday stopped working. I want my money back.", time: "16:20" },
    { kind: "action", title: "Handed to you", detail: "Refund request from Yaw · needs a person" },
    { kind: "business", text: "I'm sorry about that, Yaw. Refunds are handled by our manager, so I've passed this to Kwame. He'll reply here shortly.", time: "16:20" },
    { kind: "business", text: "Kwame here. Very sorry! Bring it in tomorrow and we'll swap it or refund you, your choice.", time: "16:24" },
  ],
};
