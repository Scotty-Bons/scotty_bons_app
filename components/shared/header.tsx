"use client";

import { MobileSidebar } from "@/components/shared/mobile-sidebar";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { UserMenu } from "@/components/shared/user-menu";

interface HeaderProps {
  role: string;
  userName: string;
  userEmail: string;
}

export function Header({ role, userName, userEmail }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-100 dark:border-border bg-white dark:bg-card flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} />
        <Breadcrumbs />
      </div>
      <UserMenu userName={userName} userEmail={userEmail} role={role} />
    </header>
  );
}
