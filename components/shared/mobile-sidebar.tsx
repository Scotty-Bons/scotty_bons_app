"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { allNavItems } from "@/lib/nav-items";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileSidebarProps {
  role: string;
}

export function MobileSidebar({ role }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-white dark:bg-card">
          <SheetHeader className="border-b border-gray-100 dark:border-border px-5 h-16 flex justify-center">
            <SheetTitle className="flex items-center">
              <Image
                src="/logo_scottybons.png"
                alt="ScottyBons"
                width={150}
                height={34}
              />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3 pt-5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
