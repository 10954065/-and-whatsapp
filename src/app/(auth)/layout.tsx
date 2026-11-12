import { AuthAside, AuthMobileSun, AuthStageProvider } from "@/components/auth/auth-stage";
import { Logo } from "@/components/brand/logo";
import { HERO_SCRIPTS } from "@/components/marketing/chat-scripts";
import { LoopingChat } from "@/components/marketing/chat-showcase";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthStageProvider>
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <main className="grain relative flex flex-col overflow-hidden px-6 py-8 sm:px-12">
          {/* Washes of the sunrise colours behind the form: sun coral, rose and dusk violet. */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-56 -left-48 size-160 rounded-full bg-[radial-gradient(circle,rgb(239_107_31/0.2),transparent_68%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -right-32 size-96 rounded-full bg-[radial-gradient(circle,rgb(232_69_107/0.12),transparent_70%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-56 -bottom-64 size-168 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.15),transparent_68%)]" />
          <Logo className="relative" />
          <div className="relative mx-auto flex w-full max-w-104 flex-1 flex-col justify-center py-10">
            <AuthMobileSun />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 p-6 shadow-[0_1px_2px_rgb(29_26_22/0.05),0_28px_60px_-28px_rgb(59_29_74/0.35)] backdrop-blur-sm sm:p-8">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#f59e0b,#ef6b1f_35%,#e8456b_68%,#8b5cf6)]" />
              {children}
            </div>
          </div>
          <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} Sunleon Router Enterprise · Accra</p>
        </main>
        <AuthAside>
          <LoopingChat script={HERO_SCRIPTS[1]} className="relative [@media(max-height:900px)]:scale-[0.85]" activityClassName="hidden" />
        </AuthAside>
      </div>
    </AuthStageProvider>
  );
}
