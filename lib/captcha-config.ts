export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
export const isCaptchaConfigured = Boolean(turnstileSiteKey)
