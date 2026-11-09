"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function AdminNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-0.5 overflow-x-auto px-1 text-[13.5px]">
      {items.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-colors",
              isActive ? "text-[#1d1a16]" : "text-white/60 hover:text-white",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="admin-nav-active"
                className="absolute inset-0 rounded-full bg-[#f3efe7]"
                transition={{ type: "spring", bounce: 0.12, duration: 0.38 }}
              />
            ) : null}
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
