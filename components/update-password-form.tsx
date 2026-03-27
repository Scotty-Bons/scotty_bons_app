"use client";

import { cn } from "@/lib/utils";
import { updatePassword } from "@/app/(auth)/update-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/login");
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
            New password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="New password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="size-5" />}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm" className="text-sm font-medium text-muted-foreground">
            Confirm new password
          </Label>
          <Input
            id="confirm"
            type="password"
            placeholder="Confirm new password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            leftIcon={<Lock className="size-5" />}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
