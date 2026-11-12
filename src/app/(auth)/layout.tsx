import { AuthAside, AuthMobileSun, AuthStageProvider } from "@/components/auth/auth-stage";
import { Logo } from "@/components/brand/logo";
import { HERO_SCRIPTS } from "@/components/marketing/chat-scripts";
import { LoopingChat } from "@/components/marketing/chat-showcase";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthStageProvider>
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <main className="grain flex flex-col px-6 py-8 sm:px-12">
          <Logo />
          <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col justify-center py-12">
            <AuthMobileSun />
            {children}
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sunleon Router Enterprise · Accra</p>
        </main>
        <AuthAside>
          <LoopingChat script={HERO_SCRIPTS[1]} className="relative [@media(max-height:900px)]:scale-[0.85]" activityClassName="hidden" />
        </AuthAside>
      </div>
    </AuthStageProvider>
  );
}
