"use client"

import { useEffect, useState } from "react"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { HomeLiveItem } from "@/lib/home-content"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function LivePlayers({
  title,
  liveLabel,
  players,
  className,
}: {
  title: string
  liveLabel: string
  players: HomeLiveItem[]
  className?: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (players.length === 0) {
      return
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % players.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [players])

  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <Circle className="h-2 w-2 fill-primary animate-pulse" />
          <span>{liveLabel}</span>
        </div>
      </div>

      <div className="space-y-3">
        {players.map((player, index) => (
          <div
            key={player.name}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2 transition-all duration-500",
              index === currentIndex && "bg-primary/10",
            )}
          >
            <Avatar className="h-8 w-8">
              {player.avatar ? <AvatarImage src={player.avatar} alt={player.name} /> : null}
              <AvatarFallback className="bg-secondary text-xs text-foreground">
                {player.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
              <p className="text-xs text-muted-foreground">{player.game}</p>
            </div>
            <span className="text-sm font-semibold text-primary">{player.amount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
