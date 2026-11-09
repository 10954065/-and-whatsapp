import type { ReactNode } from "react";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-sun" aria-hidden="true" />
        Legal
      </p>
      <h1 className="mt-5 font-display text-5xl font-normal tracking-[-0.015em] sm:text-6xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-10 text-lg leading-8 text-foreground/80">{intro}</div>
      <div className="mt-10 grid gap-10">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="flex items-baseline gap-3 text-xl font-semibold text-foreground">
              <span className="font-mono text-sm font-normal text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              {section.heading}
            </h2>
            <div className="mt-3 grid gap-3 leading-7 text-muted-foreground">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
