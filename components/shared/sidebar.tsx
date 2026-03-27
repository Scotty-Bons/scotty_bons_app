"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { allNavItems } from "@/lib/nav-items";

interface SidebarProps {
  role: string;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-gray-100 sticky top-0 h-screen overflow-y-auto bg-white dark:bg-card dark:border-border">
      <div className="flex items-center px-5 h-16 border-b border-gray-100 dark:border-border">
        <Image
          src="/logo_scottybons.png"
          alt="ScottyBons"
          width={150}
          height={34}
          priority
        />
      </div>
      <nav className="flex flex-col gap-1 p-3 pt-5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-light text-primary font-semibold dark:bg-primary/20"
                  : "text-gray-500 hover:bg-gray-50 hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted"
              )}
            >
              <Icon className={cn("size-5", isActive ? "text-primary" : "text-gray-400 dark:text-muted-foreground")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
