"use client"

import { BarChart3 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { HomeLiveItem } from "@/lib/home-content"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function LivePlayers({
  title,
  liveLabel,
  emptyLabel,
  players,
  className,
}: {
  title: string
  liveLabel: string
  emptyLabel: string
  players: HomeLiveItem[]
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>{liveLabel}</span>
        </div>
      </div>

      <div className="space-y-3">
        {players.length > 0 ? (
          players.map((player, index) => {
            const isLoss = player.amount.startsWith("-")

            return (
              <div
                key={player.name}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2 transition-colors",
                  index === 0 && "bg-primary/10",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                    {index + 1}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
                  <p className="text-xs text-muted-foreground">{player.game}</p>
                </div>
                <span className={cn("text-sm font-semibold", isLoss ? "text-destructive" : "text-primary")}>
                  {player.amount}
                </span>
              </div>
            )
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}
