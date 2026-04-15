"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, ExternalLink } from "lucide-react"

import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { ThemeHeroSurface, ThemePageShell, ThemePanelSurface } from "@/components/theme-page-shell"
import { Button } from "@/components/ui/button"
import {
  LANGUAGE_STORAGE_KEY,
  type CoreGame,
  type Language,
  getLegacyGameRoute,
} from "@/lib/home-content"

interface GamePlaceholderPageProps {
  game: CoreGame
}

function getCopy(language: Language, game: CoreGame) {
  if (language === "zh") {
    return {
      eyebrow: "游戏迁移占位页",
      title: `${game.titleZh} 正在迁移到 Next.js`,
      description: "这个页面已经接入新的 React / Next.js 路由层。当前版本先作为占位入口，后续会把真实游戏实现逐步迁进来。",
      primary: "回到首页",
      secondary: "打开旧版页面",
      noteTitle: "当前状态",
      notes: [
        "新首页已经统一把玩家流量导向这里。",
        "实际可玩的游戏主体仍保留在旧静态版本。",
        "这个路由后续会被真正的 React 游戏页面替换。",
      ],
      languageLabel: "语言",
      themeLabel: "主题",
      lightLabel: "浅色",
      darkLabel: "深色",
    }
  }

  return {
    eyebrow: "Migration Placeholder",
    title: `${game.title} is moving into Next.js`,
    description: "This route already uses the new React / Next.js shell. It currently works as a placeholder while the actual game is migrated here.",
    primary: "Back home",
    secondary: "Open legacy version",
    noteTitle: "Current status",
    notes: [
      "The new React home routes players here first.",
      "The actual playable game still lives in the legacy static version.",
      "This route will later be replaced by the real React game experience.",
    ],
    languageLabel: "Language",
    themeLabel: "Theme",
    lightLabel: "Light",
    darkLabel: "Dark",
  }
}

export function GamePlaceholderPage({ game }: GamePlaceholderPageProps) {
  const [language, setLanguage] = useState<Language>("zh")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryLanguage = params.get("lang")
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const nextLanguage =
      queryLanguage === "en" || queryLanguage === "zh"
        ? queryLanguage
        : savedLanguage === "en" || savedLanguage === "zh"
          ? savedLanguage
          : "zh"

    setLanguage(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
  }, [])

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    const url = new URL(window.location.href)
    url.searchParams.set("lang", nextLanguage)
    window.history.replaceState({}, "", url)
  }

  const copy = getCopy(language, game)

  return (
    <ThemePageShell>
      <ThemeHeroSurface className="mb-8 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">{copy.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{copy.description}</p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <LanguageToggle
              value={language}
              onChange={handleLanguageChange}
              label={copy.languageLabel}
            />
            <ThemeToggle
              label={copy.themeLabel}
              lightLabel={copy.lightLabel}
              darkLabel={copy.darkLabel}
            />
          </div>
        </div>
      </ThemeHeroSurface>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ThemePanelSurface className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{game.title}</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">{language === "zh" ? game.titleZh : game.title}</h2>
            </div>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              {game.badge[language]}
            </span>
          </div>

          <p className="mt-4 text-sm leading-7 text-muted-foreground">{game.subtitle[language]}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/?lang=${language}`}>
                <ArrowLeft className="h-4 w-4" />
                {copy.primary}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`${getLegacyGameRoute(game.slug)}?lang=${language}`}>
                <ExternalLink className="h-4 w-4" />
                {copy.secondary}
              </Link>
            </Button>
          </div>
        </ThemePanelSurface>

        <ThemePanelSurface className="p-6">
          <h3 className="text-sm font-medium text-foreground">{copy.noteTitle}</h3>
          <div className="mt-4 space-y-3">
            {copy.notes.map((note) => (
              <div key={note} className="rounded-xl border border-border/50 bg-background/70 p-4 text-sm text-muted-foreground">
                {note}
              </div>
            ))}
          </div>
        </ThemePanelSurface>
      </div>
    </ThemePageShell>
  )
}
