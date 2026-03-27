"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "group-[.toaster]:font-semibold group-[.toaster]:text-sm",
          description: "group-[.toaster]:text-muted-foreground group-[.toaster]:text-xs",
          success:
            "group-[.toaster]:!bg-emerald-50 group-[.toaster]:!border-emerald-200 group-[.toaster]:!text-emerald-900 [&_[data-icon]]:!text-emerald-600",
          error:
            "group-[.toaster]:!bg-red-50 group-[.toaster]:!border-red-200 group-[.toaster]:!text-red-900 [&_[data-icon]]:!text-red-600",
          warning:
            "group-[.toaster]:!bg-amber-50 group-[.toaster]:!border-amber-200 group-[.toaster]:!text-amber-900 [&_[data-icon]]:!text-amber-600",
          info: "group-[.toaster]:!bg-blue-50 group-[.toaster]:!border-blue-200 group-[.toaster]:!text-blue-900 [&_[data-icon]]:!text-blue-600",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
