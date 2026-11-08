import type { ReactNode } from "react";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Legal</p>
      <h1 className="mt-3 text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-8 text-base leading-7 text-muted-foreground">{intro}</div>
      <div className="mt-10 grid gap-10">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold text-foreground">
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-3 grid gap-3 leading-7 text-muted-foreground">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
