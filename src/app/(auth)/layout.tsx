import { Bot, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const highlights = [
  { icon: Bot, title: "An AI employee on WhatsApp and Instagram", body: "Answers, qualifies and follows up — day and night." },
  { icon: Sparkles, title: "Grounded in your business", body: "Replies only from the knowledge, prices and stock you provide." },
  { icon: ShieldCheck, title: "You stay in control", body: "Approval rules, spending limits and one-click human takeover." },
];

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-32 -bottom-40 size-[520px] rounded-full bg-violet/40 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/3 -left-24 size-[320px] rounded-full bg-azure/30 blur-[100px]" />
        <Logo inverted className="relative" />
        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Built in Ghana · Ready for the world</p>
          <h2 className="text-4xl leading-[1.1] font-bold">
            Every customer answered.
            <br />
            <span className="text-gradient">Every lead followed up.</span>
          </h2>
          <ul className="mt-10 grid gap-6">
            {highlights.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-white/65">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Sunleon Router Enterprise</p>
      </aside>
      <main className="flex flex-col px-6 py-10 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
