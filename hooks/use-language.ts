"use client"

import { useCallback, useEffect, useState } from "react"

import { LANGUAGE_STORAGE_KEY, type Language } from "@/lib/home-content"

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en"
}

export function useLanguage(defaultLanguage: Language = "zh") {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryLanguage = params.get("lang")
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const nextLanguage = isLanguage(queryLanguage)
      ? queryLanguage
      : isLanguage(savedLanguage)
        ? savedLanguage
        : defaultLanguage

    setLanguageState(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
  }, [defaultLanguage])

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)

    const url = new URL(window.location.href)
    url.searchParams.set("lang", nextLanguage)
    window.history.replaceState({}, "", url)
  }, [])

  return [language, setLanguage] as const
}
