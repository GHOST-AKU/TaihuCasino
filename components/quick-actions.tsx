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
        "group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        item.variant === "primary"
          ? "border-primary/35 bg-primary/10 hover:border-primary/55 hover:bg-primary/15"
          : "border-border/60 bg-secondary/35 hover:border-primary/25 hover:bg-secondary/55",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          item.variant === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-primary group-hover:bg-primary/15",
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
    <div className={cn("lobby-panel-surface rounded-2xl border border-border/50 p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-2.5">
        {items.map((item, index) => {
          const Icon = actionIcons[index % actionIcons.length]

          return <QuickAction key={item.key} item={item} icon={<Icon className="h-5 w-5" />} />
        })}
      </div>
    </div>
  )
}
