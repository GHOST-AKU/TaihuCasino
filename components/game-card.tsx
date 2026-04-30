"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, Star, TrendingUp, Users } from "lucide-react"

import { cn } from "@/lib/utils"

interface GameCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  players: number
  rating: number
  trend: string
  featured?: boolean
  className?: string
  href: string
  badgeLabel?: string
  ctaLabel?: string
}

export function GameCard({
  title,
  subtitle,
  icon,
  players,
  rating,
  trend,
  featured = false,
  className,
  href,
  badgeLabel,
  ctaLabel = "Enter",
}: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex h-full min-h-[320px] cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all duration-500",
        "hover:border-primary/30 hover:shadow-[0_0_40px_rgba(0,200,150,0.08)]",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500",
          isHovered && "opacity-100",
        )}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/80 text-primary transition-all duration-300",
            isHovered && "scale-105 bg-primary/20",
          )}
        >
          {icon}
        </div>

        <h3
          className={cn(
            "mb-1 text-xl font-semibold text-foreground transition-colors",
            isHovered && "text-primary",
          )}
        >
          {title}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{players.toLocaleString()} playing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span>{rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>{trend}</span>
          </div>
        </div>

        <span className="mt-4 text-sm font-medium text-primary">{ctaLabel}</span>

        <div
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300",
            isHovered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
          )}
        >
          <ChevronRight className="h-6 w-6 text-primary" />
        </div>
      </div>

      {featured && badgeLabel && (
        <div className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
          {badgeLabel}
        </div>
      )}
    </Link>
  )
}
