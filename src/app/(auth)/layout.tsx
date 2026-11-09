import { Logo } from "@/components/brand/logo";
import { HERO_SCRIPTS } from "@/components/marketing/chat-scripts";
import { LoopingChat } from "@/components/marketing/chat-showcase";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="grain flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sunleon Router Enterprise · Accra</p>
      </main>
      <aside className="grain relative hidden overflow-hidden bg-[#1d1a16] text-[#f3efe7] lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-10 lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-72 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-sun/90" />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-28 left-0 h-3 bg-[#1d1a16]/45" />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-14 left-0 h-3 bg-[#1d1a16]/30" />
        <p className="relative max-w-sm text-center font-display text-4xl leading-[1.05] tracking-[-0.01em]">
          Every customer answered. <span className="text-[#f6b383] italic">Every booking kept.</span>
        </p>
        <LoopingChat script={HERO_SCRIPTS[1]} className="relative [@media(max-height:900px)]:scale-[0.85]" activityClassName="hidden" />
      </aside>
    </div>
  );
}
