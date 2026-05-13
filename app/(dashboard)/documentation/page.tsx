import { redirect } from "next/navigation";
import { readFileSync } from "fs";
import { join } from "path";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { DocumentationWiki } from "@/components/documentation/documentation-wiki";
import { DocumentationToc, type TocHeading } from "@/components/documentation/documentation-toc";

export const metadata = { title: "Documentation" };

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        id: slugify(match[2].trim()),
      });
    }
  }
  return headings;
}

export default async function DocumentationPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/orders");

  const content = readFileSync(join(process.cwd(), "docs", "entrega.md"), "utf-8");
  const headings = extractHeadings(content);

  return (
    <div className="pb-12">
      <div className="mb-8">
        <h1 className="text-xl font-bold">Documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System handover guide — modules, administration, and technical reference.
        </p>
      </div>

      <div className="flex gap-10 items-start">
        <DocumentationToc headings={headings} />
        <div className="flex-1 min-w-0">
          <DocumentationWiki content={content} />
        </div>
      </div>
    </div>
  );
}
