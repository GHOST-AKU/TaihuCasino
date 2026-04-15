"use client"

import Link from "next/link"
import { Crown, Gift, History, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { HomeActionItem } from "@/lib/home-content"

function QuickAction({
  item,
  icon,
}: {
  item: HomeActionItem
  icon: React.ReactNode
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-300",
        item.variant === "primary"
          ? "border-primary/30 bg-primary/10 hover:border-primary/50 hover:bg-primary/20"
          : "border-border/50 bg-card hover:border-primary/20 hover:bg-card/80",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          item.variant === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-primary group-hover:bg-primary/20",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", item.variant === "primary" ? "text-primary" : "text-foreground")}>
          {item.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
      </div>
    </Link>
  )
}

const actionIcons = [Plus, Gift, Crown, History]

export function QuickActions({
  title,
  items,
  className,
}: {
  title: string
  items: HomeActionItem[]
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card/50 p-5", className)}>
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      <div className="grid gap-3">
        {items.map((item, index) => {
          const Icon = actionIcons[index % actionIcons.length]

          return <QuickAction key={item.key} item={item} icon={<Icon className="h-5 w-5" />} />
        })}
      </div>
    </div>
  )
}
