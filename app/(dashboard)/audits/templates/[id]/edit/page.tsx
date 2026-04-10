import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import type { AuditTemplateCategoryRow, AuditTemplateItemRow } from "@/lib/types";
import { TemplateFormPage } from "@/components/audits/template-form-page";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/orders");

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("audit_templates")
    .select("id, name, description")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const [{ data: categoriesData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("audit_template_categories")
      .select("id, template_id, name, sort_order, created_at")
      .eq("template_id", id)
      .order("sort_order"),
    supabase
      .from("audit_template_items")
      .select("id, template_id, category_id, label, description, sort_order, rating_labels, created_at")
      .eq("template_id", id)
      .order("sort_order"),
  ]);

  const categories = (categoriesData ?? []) as AuditTemplateCategoryRow[];
  const items = (itemsData ?? []) as AuditTemplateItemRow[];

  const defaultValues = {
    name: template.name,
    description: template.description ?? undefined,
    categories: categories.map((cat) => ({
      name: cat.name,
      items: items
        .filter((i) => i.category_id === cat.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          label: i.label,
          description: i.description ?? undefined,
          rating_options: i.rating_labels,
        })),
    })),
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <TemplateFormPage templateId={template.id} defaultValues={defaultValues} />
    </div>
  );
}
