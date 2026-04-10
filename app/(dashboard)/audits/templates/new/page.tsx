import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { TemplateFormPage } from "@/components/audits/template-form-page";

export default async function NewTemplatePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/orders");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <TemplateFormPage />
    </div>
  );
}
