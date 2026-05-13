"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

interface Props {
  content: string;
}

export function DocumentationWiki({ content }: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children, ...props }) {
            const text = typeof children === "string" ? children : String(children);
            return (
              <h1
                {...props}
                id={slugify(text)}
                className="text-2xl font-bold text-primary mt-10 mb-4 pb-2 border-b border-border first:mt-0 scroll-mt-6"
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            const text = typeof children === "string" ? children : String(children);
            return (
              <h2
                {...props}
                id={slugify(text)}
                className="text-lg font-semibold text-foreground mt-8 mb-3 scroll-mt-6"
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            const text = typeof children === "string" ? children : String(children);
            return (
              <h3
                {...props}
                id={slugify(text)}
                className="text-base font-semibold text-foreground mt-6 mb-2 scroll-mt-6"
              >
                {children}
              </h3>
            );
          },
          p({ children, ...props }) {
            return (
              <p {...props} className="text-sm text-foreground leading-relaxed mb-4">
                {children}
              </p>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                {...props}
                className="my-4 border-l-4 border-primary bg-primary-light rounded-r-lg px-4 py-3 text-sm text-foreground [&_p]:mb-0"
              >
                {children}
              </blockquote>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul {...props} className="mb-4 space-y-1.5 pl-1">
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol {...props} className="mb-4 space-y-1.5 list-decimal pl-5">
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            const childArray = Array.isArray(children) ? children : [children];
            const firstChild = childArray[0];
            const isTask =
              typeof firstChild === "string" &&
              (firstChild.startsWith("[x] ") || firstChild.startsWith("[ ] "));

            if (isTask && typeof firstChild === "string") {
              const checked = firstChild.startsWith("[x] ");
              const text = firstChild.slice(4);
              return (
                <li {...props} className="flex items-start gap-2 text-sm text-foreground">
                  <span
                    className={cn(
                      "mt-0.5 flex-shrink-0 size-4 rounded flex items-center justify-center text-xs font-bold",
                      checked
                        ? "bg-success text-white"
                        : "border border-border bg-muted"
                    )}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span>{text}{childArray.slice(1)}</span>
                </li>
              );
            }

            return (
              <li {...props} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 flex-shrink-0 size-1.5 rounded-full bg-primary" />
                <span>{children}</span>
              </li>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="my-4 overflow-x-auto rounded-lg border border-border">
                <table {...props} className="w-full text-sm border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }) {
            return (
              <thead {...props} className="bg-muted">
                {children}
              </thead>
            );
          },
          th({ children, ...props }: ComponentPropsWithoutRef<"th">) {
            return (
              <th
                {...props}
                className="px-4 py-2.5 text-left text-xs font-semibold text-foreground border-b border-border"
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }: ComponentPropsWithoutRef<"td">) {
            return (
              <td
                {...props}
                className="px-4 py-2.5 text-sm text-foreground border-b border-border last:border-b-0 [tr:last-child_&]:border-b-0"
              >
                {children}
              </td>
            );
          },
          tr({ children, ...props }) {
            return (
              <tr
                {...props}
                className="transition-colors hover:bg-muted/50 [&:last-child_td]:border-b-0"
              >
                {children}
              </tr>
            );
          },
          code({ children, className, ...props }) {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <pre className="my-4 overflow-x-auto rounded-lg bg-muted border border-border p-4">
                  <code className="text-xs font-mono text-foreground">
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code
                {...props}
                className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground border border-border"
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          hr() {
            return <hr className="my-8 border-border" />;
          },
          a({ children, href, ...props }) {
            return (
              <a
                {...props}
                href={href}
                className="text-primary font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          strong({ children, ...props }) {
            return (
              <strong {...props} className="font-semibold text-foreground">
                {children}
              </strong>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
