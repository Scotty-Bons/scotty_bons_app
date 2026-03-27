"use client";

import { cn } from "@/lib/utils";
import { signIn } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.data!.redirectTo);
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to restock your inventory.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        {/* Email */}
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="franchise@exemple.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="size-5" />}
          />
        </div>

        {/* Password */}
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Type your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="size-5" />}
              className="pr-11"
            />
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Login button */}
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Login"}
        </Button>
      </form>

    </div>
  );
}
