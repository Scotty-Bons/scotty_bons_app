"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AuditTemplateRow } from "@/lib/types";
import {
  toggleTemplateActive,
  deleteTemplate,
} from "@/app/(dashboard)/audits/templates/actions";

interface TemplatesClientProps {
  templates: AuditTemplateRow[];
}

export function TemplatesClient({ templates }: TemplatesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingTemplate, setDeletingTemplate] = useState<AuditTemplateRow | null>(null);

  function handleToggle(template: AuditTemplateRow, checked: boolean) {
    startTransition(async () => {
      const result = await toggleTemplateActive(template.id, checked);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(checked ? "Template activated." : "Template deactivated.");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deletingTemplate) return;
    startTransition(async () => {
      const result = await deleteTemplate(deletingTemplate!.id);
      if (result.error) {
        toast.error(result.error);
        setDeletingTemplate(null);
        return;
      }
      toast.success("Template deleted.");
      setDeletingTemplate(null);
      router.refresh();
    });
  }

  return (
    <>
      <nav className="text-sm flex items-center gap-1.5">
        <Link
          href="/audits"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Audits
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Templates</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Templates</h1>
        <Button asChild>
          <Link href="/audits/templates/new">
            <Plus className="size-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first audit checklist template.
            </p>
            <Button asChild>
              <Link href="/audits/templates/new">New Template</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{template.name}</p>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.item_count} {template.item_count === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => handleToggle(template, checked)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                      >
                        <Link href={`/audits/templates/${template.id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeletingTemplate(template)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
