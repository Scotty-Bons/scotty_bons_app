"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeOrderList({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          router.refresh();
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div>
      {isLive && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      )}
      {children}
    </div>
  );
}
