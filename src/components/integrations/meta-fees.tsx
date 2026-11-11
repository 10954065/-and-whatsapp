import { META_FREE_REPLIES_PER_MONTH, META_WHATSAPP_PRICING_URL } from "@/config/whatsapp-fees";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What Meta charges for WhatsApp, in one place, so the pricing page and the connection
 * screen can never disagree.
 */
export function MetaFeeNotice({ className }: { className?: string }) {
  const free = formatNumber(META_FREE_REPLIES_PER_MONTH);
  return (
    <div className={cn("grid gap-3 text-sm leading-relaxed", className)}>
      <p>
        Meta charges for WhatsApp messages separately from your SUNLEON plan and bills your own WhatsApp Business
        account directly. SUNLEON doesn&apos;t add to that bill or take a share of it.
      </p>
      <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground marker:text-muted-foreground/60">
        <li>Messages your customers send you are always free.</li>
        <li>
          Each WhatsApp number gets {free} free replies a month, counted when delivered. Replies from the assistant
          and from your team both count.
        </li>
        <li>After the first {free}, Meta charges for each delivered reply at its rate for Ghana, listed under Rest of Africa.</li>
        <li>Template messages, needed to reach a customer more than 24 hours after their last message, are charged separately.</li>
        <li>Add a payment method in Meta Billing Hub. Without one, Meta stops delivering your replies once the free {free} are used.</li>
      </ul>
      <p>
        <a href={META_WHATSAPP_PRICING_URL} target="_blank" rel="noopener noreferrer" className="font-medium link-underline">
          See Meta&apos;s current WhatsApp pricing
        </a>
      </p>
    </div>
  );
}
