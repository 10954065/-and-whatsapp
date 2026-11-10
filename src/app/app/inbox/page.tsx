import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { AccessDenied, EmptyState } from "@/components/app/page-primitives";
import {
  ControlToggle,
  ConversationSettings,
  InboxAutoRefresh,
  MessageThread,
  NoteForm,
  ReplyComposer,
  SimulateMessageForm,
} from "@/components/inbox/inbox-client";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { requireTenant, toActor } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { getConversationDetail, listConversations, markRead, type InboxFilters } from "@/modules/messaging/inbox.service";
import { isWithinServiceWindow } from "@/modules/messaging/outbound.service";

export const metadata: Metadata = { title: "Inbox" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SANDBOX: "Test" };
const CHANNEL_DOT: Record<string, string> = { WHATSAPP: "bg-whatsapp", INSTAGRAM: "bg-instagram", SANDBOX: "bg-foreground/30" };

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}
const FILTERS = [
  { key: "", label: "All open" },
  { key: "unread", label: "Unread" },
  { key: "mine", label: "Assigned to me" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "RESOLVED", label: "Resolved" },
];

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("inbox.read")) return <AccessDenied what="the inbox" />;
  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "";
  const search = typeof params.q === "string" ? params.q.slice(0, 80) : undefined;
  const filters: InboxFilters = {
    unread: filter === "unread",
    mine: filter === "mine",
    channel: filter === "WHATSAPP" || filter === "INSTAGRAM" ? filter : undefined,
    status: filter === "RESOLVED" ? "RESOLVED" : undefined,
    search,
  };
  const conversations = await listConversations(context.businessId, context.user.id, filters);
  const selectedId = typeof params.conversation === "string" ? params.conversation : conversations[0]?.id;
  const detail = selectedId ? await getConversationDetail(context.businessId, selectedId) : null;
  if (detail && detail.conversation.unreadCount > 0) await markRead(toActor(context), detail.conversation.id);
  const [members, sandbox] = await Promise.all([
    prisma.businessMembership.findMany({ where: { businessId: context.businessId, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
    prisma.integration.findFirst({ where: { businessId: context.businessId, channel: "SANDBOX", status: "CONNECTED" } }),
  ]);
  const canReply = context.can("inbox.reply");
  const query = (extra: Record<string, string>) => new URLSearchParams({ ...(filter ? { filter } : {}), ...(search ? { q: search } : {}), ...extra }).toString();

  return (
    <div data-fullbleed className="grid h-[calc(100svh-3.5rem)] grid-cols-1 lg:grid-cols-[21rem_minmax(0,1fr)_18rem]">
      <InboxAutoRefresh />
      <aside className="flex min-h-0 flex-col border-r bg-sidebar">
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">Inbox</h1>
          <form className="mt-4" action="/app/inbox">
            {filter ? <input type="hidden" name="filter" value={filter} /> : null}
            <input
              name="q"
              defaultValue={search}
              placeholder="Search customers or messages"
              aria-label="Search conversations"
              className="h-9 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </form>
        </div>
        <nav aria-label="Inbox filters" className="flex flex-wrap gap-1 px-3 pb-3">
          {FILTERS.map((option) => (
            <Link
              key={option.key}
              href={`/app/inbox?${new URLSearchParams({ ...(option.key ? { filter: option.key } : {}), ...(search ? { q: search } : {}) }).toString()}`}
              className={cn(
                "pressable shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                filter === option.key ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/[0.06]",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No conversations here yet.</li> : null}
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedId;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/app/inbox?${query({ conversation: conversation.id })}`}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex gap-3 rounded-[14px] px-2.5 py-2.5 transition-colors",
                    isSelected ? "bg-card shadow-[var(--shadow-hairline),0_1px_3px_rgb(0_0_0/0.05)]" : "hover:bg-foreground/[0.04]",
                  )}
                >
                  <span className="relative mt-0.5 self-start">
                    <span className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-[13px] font-semibold text-foreground/75">
                      {initialsOf(conversation.customer.displayName)}
                    </span>
                    <span className={cn("absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-sidebar", CHANNEL_DOT[conversation.channel])} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("flex-1 truncate text-[14px]", conversation.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                        {conversation.customer.displayName}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{formatRelative(conversation.lastMessageAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="line-clamp-2 flex-1 text-[13px] leading-snug text-muted-foreground">{conversation.lastMessagePreview}</span>
                      {conversation.unreadCount > 0 ? (
                        <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-sun px-1.5 text-[11px] leading-5 font-semibold text-sun-foreground">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {CHANNEL_LABEL[conversation.channel]}
                      <span aria-hidden="true">·</span>
                      {conversation.control === "HUMAN" ? <span className="font-medium text-warning">You&apos;re replying</span> : "Assistant"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col bg-background">
        {detail ? (
          <>
            <header className="material flex items-center gap-3 border-b px-4 py-3 sm:px-8">
              <span className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-[13px] font-semibold text-foreground/75">
                {initialsOf(detail.conversation.customer.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{detail.conversation.customer.displayName}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", CHANNEL_DOT[detail.conversation.channel])} aria-hidden="true" />
                  {CHANNEL_LABEL[detail.conversation.channel]} · {detail.conversation.control === "AI" ? "The assistant is replying" : "A person is replying"}
                </p>
              </div>
              {canReply ? <ControlToggle conversationId={detail.conversation.id} control={detail.conversation.control} /> : null}
            </header>
            <MessageThread
              key={detail.conversation.id}
              messages={detail.messages.map((message) => ({
                id: message.id,
                isOutbound: message.direction === "OUTBOUND",
                sender: message.sender,
                text: message.text ?? `[${message.type.toLowerCase()}]`,
                time: formatDateTime(message.createdAt, context.business.timezone),
                status: message.deliveryStatus,
                error: message.errorMessage,
              }))}
            />
            {canReply ? (
              <ReplyComposer
                conversationId={detail.conversation.id}
                disabledReason={
                  detail.conversation.channel !== "SANDBOX" && !isWithinServiceWindow(detail.conversation.lastInboundAt)
                    ? "The 24-hour reply window has closed. WhatsApp requires an approved template."
                    : null
                }
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={Inbox}
              title="No conversations yet"
              description="Messages from WhatsApp and Instagram appear here. Turn on the test channel in Integrations to try it now."
            />
          </div>
        )}
      </section>

      <aside className="hidden min-h-0 space-y-6 overflow-y-auto border-l bg-sidebar p-5 lg:block">
        {detail ? (
          <>
            <section>
              <h2 className="text-sm font-semibold">Customer</h2>
              <p className="mt-1 text-sm">{detail.conversation.customer.displayName}</p>
              {detail.conversation.customer.phone ? <p className="text-xs text-muted-foreground">{detail.conversation.customer.phone}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {detail.conversation.customer.leads.map((lead) => (
                  <Badge key={lead.id} variant="secondary">Lead · {lead.status.toLowerCase()}</Badge>
                ))}
              </div>
            </section>
            {detail.conversation.customer.orders.length ? (
              <section>
                <h2 className="text-sm font-semibold">Recent orders</h2>
                <ul className="mt-1 space-y-1 text-xs">
                  {detail.conversation.customer.orders.map((order) => (
                    <li key={order.id}>#{order.number} · {formatMoney(order.totalMinor, order.currency)} · {order.paymentStatus.toLowerCase()}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {detail.conversation.customer.bookings.length ? (
              <section>
                <h2 className="text-sm font-semibold">Bookings</h2>
                <ul className="mt-1 space-y-1 text-xs">
                  {detail.conversation.customer.bookings.map((booking) => (
                    <li key={booking.id}>{booking.service.name} · {formatDateTime(booking.startsAt, context.business.timezone)}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {context.can("inbox.manage") ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold">Conversation</h2>
                <ConversationSettings
                  conversationId={detail.conversation.id}
                  status={detail.conversation.status}
                  assignedToId={detail.conversation.assignedToId}
                  tags={detail.conversation.tags}
                  members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
                />
              </section>
            ) : null}
            {detail.aiRuns.length ? (
              <section>
                <h2 className="text-sm font-semibold">Assistant activity</h2>
                <ul className="mt-1 space-y-1.5 text-xs text-muted-foreground">
                  {detail.aiRuns.map((run) => (
                    <li key={run.id}>
                      {formatRelative(run.createdAt)} · {run.status.toLowerCase()} · {run.tier}
                      {run.actions.length ? ` · ${run.actions.map((action) => action.tool).join(", ")}` : ""}
                      {run.policyFlags.length ? ` · ${run.policyFlags.join(", ")}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section>
              <h2 className="mb-2 text-sm font-semibold">Internal notes</h2>
              <ul className="mb-2 space-y-2 text-xs">
                {detail.conversation.notes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-muted p-2">
                    <span className="font-medium">{note.author.name}:</span> {note.body}
                  </li>
                ))}
              </ul>
              {canReply ? <NoteForm conversationId={detail.conversation.id} /> : null}
            </section>
          </>
        ) : null}
        {sandbox && canReply ? (
          <section className="rounded-2xl border border-dashed border-foreground/15 p-4">
            <h2 className="mb-2 text-sm font-semibold">Simulate a customer (test channel)</h2>
            <SimulateMessageForm />
          </section>
        ) : null}
      </aside>
    </div>
  );
}
