"use client";

import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
  showHero?: boolean;
}

export function AuthLayout({ children, showHero = false }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-white dark:bg-background">
      {showHero && (
        <div className="relative h-56 w-full overflow-hidden sm:h-64">
          {/* Gradient placeholder — replace with <Image src="/login-hero.jpg"> when asset is ready */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-amber-300" />
          {/* Logo overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            <Image
              src="/logo_scottybons.png"
              alt="ScottyBons"
              width={200}
              height={46}
              className="drop-shadow-lg brightness-0 invert"
              priority
            />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-start px-6 py-8 sm:justify-center sm:py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
