"use client"

import { Flame, Target, Trophy, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import type { HomeStatItem } from "@/lib/home-content"

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
  trend?: "up" | "down" | "neutral"
  className?: string
}

function StatItem({ icon, label, value, subtext, trend, className }: StatItemProps) {
  return (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all duration-300",
        "hover:border-primary/20 hover:bg-card/80",
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
        {subtext && (
          <p
            className={cn(
              "mt-0.5 text-xs",
              trend === "up" && "text-primary",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  )
}

const statIcons = [Wallet, Trophy, Target, Flame]

export function PlayerStats({ items, className }: { items: HomeStatItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item, index) => {
        const Icon = statIcons[index % statIcons.length]

        return (
          <StatItem
            key={item.key}
            icon={<Icon className="h-5 w-5" />}
            label={item.label}
            value={item.value}
            subtext={item.subtext}
            trend={item.trend}
          />
        )
      })}
    </div>
  )
}
