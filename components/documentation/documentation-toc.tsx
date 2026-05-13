"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocHeading {
  level: number;
  text: string;
  id: string;
}

interface Props {
  headings: TocHeading[];
}

export function DocumentationToc({ headings }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headingEls = headings
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 0 }
    );

    headingEls.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [headings]);

  const h2Headings = headings.filter((h) => h.level === 2);

  return (
    <nav className="hidden lg:flex lg:flex-col w-56 shrink-0 sticky top-6 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-0.5 flex-1">
        {headings
          .filter((h) => h.level === 2 || h.level === 3)
          .map((heading) => {
            const isActive = activeId === heading.id;
            const isH2 = heading.level === 2;
            return (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(heading.id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                    setActiveId(heading.id);
                  }}
                  className={cn(
                    "block rounded-md px-2 py-1 text-xs transition-colors leading-snug",
                    isH2 ? "font-medium" : "pl-4 font-normal",
                    isActive
                      ? "bg-primary-light text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
      </ul>

      {h2Headings.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {h2Headings.length} sections
          </p>
        </div>
      )}
    </nav>
  );
}
