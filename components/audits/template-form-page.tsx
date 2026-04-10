"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateForm } from "@/components/audits/template-form";
import {
  createTemplate,
  updateTemplate,
} from "@/app/(dashboard)/audits/templates/actions";
import type { CreateTemplateValues } from "@/lib/validations/audit-templates";

interface TemplateFormPageProps {
  templateId?: string;
  defaultValues?: CreateTemplateValues;
}

export function TemplateFormPage({ templateId, defaultValues }: TemplateFormPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(values: CreateTemplateValues) {
    startTransition(async () => {
      if (templateId) {
        const result = await updateTemplate(templateId, values);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template updated successfully.");
      } else {
        const result = await createTemplate(values);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template created successfully.");
      }
      router.push("/audits/templates");
      router.refresh();
    });
  }

  function handleCancel() {
    router.push("/audits/templates");
  }

  return (
    <>
      <nav className="text-sm flex items-center gap-1.5">
        <Link
          href="/audits/templates"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Templates
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{templateId ? "Edit Template" : "New Template"}</span>
      </nav>

      <h1 className="text-2xl font-bold">
        {templateId ? "Edit Template" : "New Template"}
      </h1>

      <Card>
        <CardContent className="pt-6">
          <TemplateForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </>
  );
}
