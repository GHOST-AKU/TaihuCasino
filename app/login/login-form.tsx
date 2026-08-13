"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Lock, Mail, RefreshCw, Spade, UserPlus } from "lucide-react"

import { CaptchaDialog, isCaptchaConfigured } from "@/components/captcha-dialog"
import { Button } from "@/components/ui/button"
import {
  ConfirmationResendError,
  loginMember,
  registerMember,
  resendMemberConfirmation,
  startOAuthSignIn,
  type OAuthProviderKey,
} from "@/lib/member-session"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"
import { cn } from "@/lib/utils"

const providerButtons = [
  {
    key: "google",
    label: "Google",
    className: "bg-white hover:bg-white/90",
    src: "/brands/google-g-logo.png",
    imgClassName: "h-7 w-7",
    width: 28,
    height: 28,
  },
  {
    key: "apple",
    label: "Apple",
    className: "bg-black hover:bg-[#121212]",
    src: "/brands/apple-logo.svg",
    imgClassName: "h-6 w-6 invert",
    width: 24,
    height: 24,
  },
  {
    key: "microsoft",
    label: "Microsoft",
    className: "bg-[#2f2f2f] hover:bg-[#393939]",
    src: "/brands/microsoft-logo.svg",
    imgClassName: "h-6 w-6",
    width: 24,
    height: 24,
  },
  {
    key: "facebook",
    label: "Facebook",
    className: "bg-[#2f74da] hover:bg-[#2a68c4]",
    src: "/brands/facebook-logo.png",
    imgClassName: "h-6 w-6 brightness-0 invert",
    width: 24,
    height: 24,
  },
  {
    key: "x",
    label: "X",
    className: "bg-black hover:bg-[#121212]",
    src: "/brands/x-logo.svg",
    imgClassName: "h-5 w-5 invert",
    width: 20,
    height: 20,
  },
  {
    key: "discord",
    label: "Discord",
    className: "bg-[#5865f2] hover:bg-[#4f5bd9]",
    src: "/brands/discord-logo.svg",
    imgClassName: "h-7 w-7",
    width: 28,
    height: 28,
  },
  {
    key: "twitch",
    label: "Twitch",
    className: "bg-[#9146ff] hover:bg-[#823ee5]",
    src: "/brands/twitch-logo.svg",
    imgClassName: "h-7 w-7",
    width: 28,
    height: 28,
  },
] satisfies Array<{
  key: OAuthProviderKey
  label: string
  className: string
  src: string
  imgClassName: string
  width: number
  height: number
}>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getAuthErrorMessage(authError?: string, providerKey?: string) {
  if (!authError) return ""

  const provider = providerButtons.find(({ key }) => key === providerKey)?.label ?? "The provider"
  const messages: Record<string, string> = {
    provider_denied: `${provider} authorization was cancelled. No account changes were made; you can try again or use email sign-in.`,
    callback_failed: "Social sign-in returned an invalid or incomplete response. Please try again; if it repeats, contact support with the time of the attempt.",
    oauth: "Social sign-in could not be completed. Please try again or use email sign-in.",
    invalid_link: "This verification or sign-in link is invalid or has expired. Enter your account email below and request a fresh confirmation link.",
    consent: "Social sign-in stopped because the required consent record could not be saved. Review the acknowledgements and try again.",
    consent_required: "Accept the Terms, Privacy framework, and age acknowledgement before social sign-in.",
    unsupported_provider: "That social sign-in provider is not supported.",
    oauth_unavailable: "Social sign-in is not configured yet. Use email sign-in for now.",
    provider_unavailable: `${provider} could not start sign-in. Please wait a moment and try again.`,
  }

  return messages[authError] ?? "Sign-in could not be completed. Please try again."
}

const stats = [
  { value: "Virtual", label: "No cash value" },
  { value: "Calm", label: "Responsible pacing" },
  { value: "Clear", label: "Explainable play" },
]

interface TestAccountHint {
  account: string
  password: string
  displayName?: string
}

type AuthMode = "sign-in" | "register"

function ProviderButton({
  label,
  className,
  src,
  imgClassName,
  width,
  height,
  loading,
  onClick,
  disabled,
}: {
  label: string
  className: string
  src: string
  imgClassName: string
  width: number
  height: number
  loading: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={`Continue with ${label}`}
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "flex h-15 items-center justify-center rounded-[1.35rem] shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Image
          src={src}
          alt={label}
          width={width}
          height={height}
          className={imgClassName}
        />
      )}
    </button>
  )
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  trailing,
  action,
  autoComplete,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  icon: React.ReactNode
  trailing?: React.ReactNode
  action?: React.ReactNode
  autoComplete?: string
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {action}
      </div>
      <div className="casino-auth-field group flex h-14 items-center rounded-[1.25rem] border px-4 transition-all duration-200 focus-within:border-primary/35">
        <span className="mr-3 text-[var(--auth-faint-text)] transition-colors group-focus-within:text-primary">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-full w-full bg-transparent text-base text-foreground outline-none placeholder:text-[var(--auth-faint-text)]"
        />
        {trailing ? <span className="ml-3 text-[var(--auth-faint-text)]">{trailing}</span> : null}
      </div>
    </label>
  )
}

export function LoginForm({
  initialMode = "sign-in",
  next,
  testAccount,
  authError,
  authProvider,
}: {
  initialMode?: AuthMode
  next?: string
  testAccount?: TestAccountHint | null
  authError?: string
  authProvider?: string
}) {
  const router = useRouter()
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [ageAttested, setAgeAttested] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState(() => getAuthErrorMessage(authError, authProvider))
  const [statusMessage, setStatusMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(authError === "invalid_link")
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0)
  const [captchaToken, setCaptchaToken] = useState("")
  const [captchaDialogOpen, setCaptchaDialogOpen] = useState(false)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const formRef = useRef<HTMLFormElement | null>(null)
  const submitAfterCaptchaRef = useRef(false)
  const resendAfterCaptchaRef = useRef<{ email: string; next?: string } | null>(null)
  const isRegisterMode = authMode === "register"

  function resetCaptcha() {
    resendAfterCaptchaRef.current = null
    setCaptchaToken("")
    setCaptchaResetKey((current) => current + 1)
    setCaptchaDialogOpen(true)
  }

  useEffect(() => {
    if (!captchaToken) {
      return
    }

    if (submitAfterCaptchaRef.current) {
      submitAfterCaptchaRef.current = false
      setCaptchaDialogOpen(false)
      formRef.current?.requestSubmit()
      return
    }

    const pendingResend = resendAfterCaptchaRef.current
    if (!pendingResend) return

    resendAfterCaptchaRef.current = null
    setCaptchaDialogOpen(false)
    setIsResending(true)
    void resendMemberConfirmation(pendingResend.email, captchaToken, pendingResend.next)
      .then((message) => {
        setErrorMessage("")
        setStatusMessage(message)
        setConfirmationPending(true)
        setResendCooldownSeconds(60)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to resend the confirmation email."
        setErrorMessage(message)
        if (error instanceof ConfirmationResendError && error.retryAfterSeconds) {
          setResendCooldownSeconds(error.retryAfterSeconds)
        } else if (/too many|recently|wait before/i.test(message)) {
          setResendCooldownSeconds(60)
        }
      })
      .finally(() => {
        setIsResending(false)
        setCaptchaToken("")
        setCaptchaResetKey((current) => current + 1)
      })
  }, [captchaToken])

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return
    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1))
    }, 1_000)
    return () => window.clearTimeout(timer)
  }, [resendCooldownSeconds])

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode)
    setErrorMessage("")
    setStatusMessage("")
    setConfirmationPending(false)
    setCaptchaToken("")
    setCaptchaResetKey((current) => current + 1)
    submitAfterCaptchaRef.current = false
    resendAfterCaptchaRef.current = null

    const params = new URLSearchParams()
    if (mode === "register") {
      params.set("mode", "register")
    }
    if (next) {
      params.set("next", next)
    }

    const query = params.toString()
    router.replace(query ? `/login?${query}` : "/login", { scroll: false })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMessage("Please enter your email or member ID.")
      return
    }

    if (isRegisterMode) {
      const trimmedDisplayName = displayName.trim()
      if (!trimmedDisplayName) {
        setErrorMessage("Please enter a player name.")
        return
      }

      if (password.trim().length < 8) {
        setErrorMessage("Password must be at least 8 characters for account creation.")
        return
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.")
        return
      }

      if (!termsAccepted || !ageAttested) {
        setErrorMessage("Accept the draft Terms and Privacy framework and confirm age eligibility to continue.")
        return
      }

      if (!isCaptchaConfigured) {
        setErrorMessage("Security check is not configured.")
        return
      }

      const activeCaptchaToken = captchaToken

      if (!activeCaptchaToken) {
        setErrorMessage("Complete the security check in the pop-up to continue.")
        submitAfterCaptchaRef.current = true
        setCaptchaDialogOpen(true)
        return
      }

      setErrorMessage("")
      setStatusMessage("")
      setIsSubmitting(true)

      try {
        const result = await registerMember({
          email: trimmedEmail,
          password,
          displayName: trimmedDisplayName,
          captchaToken: activeCaptchaToken,
          termsAccepted,
          ageAttested,
          locale: navigator.language,
          next,
        })

        if (result.session) {
          router.push(resolveAppRedirectTarget(next))
          router.refresh()
          return
        }

        if (result.confirmationRequired) {
          setConfirmationPending(true)
          setStatusMessage(
            "Your account is created, but email verification is required before full member access. Open the link in your inbox, then return here if it has expired or never arrives.",
          )
          setPassword("")
          setConfirmPassword("")
          return
        }

        setPassword("")
        setConfirmPassword("")
        setConfirmationPending(false)
        switchAuthMode("sign-in")
        setStatusMessage("Account created. You can sign in now.")
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to create account.")
        resetCaptcha()
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (password.trim().length < 4) {
      setErrorMessage("Password must be at least 4 characters for demo sign in.")
      return
    }

    if (!isCaptchaConfigured) {
      setErrorMessage("Security check is not configured.")
      return
    }

    const activeCaptchaToken = captchaToken
    if (!activeCaptchaToken) {
      setErrorMessage("Complete the security check in the pop-up to continue.")
      submitAfterCaptchaRef.current = true
      setCaptchaDialogOpen(true)
      return
    }

    setErrorMessage("")
    setStatusMessage("")
    setIsSubmitting(true)

    try {
      await loginMember(trimmedEmail, password, activeCaptchaToken)
      router.push(resolveAppRedirectTarget(next))
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.")
      resetCaptcha()
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleUseTestAccount() {
    if (!testAccount) {
      return
    }

    setEmail(testAccount.account)
    setPassword(testAccount.password)
    setAuthMode("sign-in")
    setErrorMessage("")
    setStatusMessage("")
  }

  function handleCaptchaDialogOpenChange(open: boolean) {
    setCaptchaDialogOpen(open)
    if (!open && !captchaToken) {
      submitAfterCaptchaRef.current = false
      resendAfterCaptchaRef.current = null
    }
  }

  function handleResendConfirmation() {
    if (isResending) return

    if (resendCooldownSeconds > 0) {
      setStatusMessage(`A request was already sent. You can request another in ${resendCooldownSeconds} seconds.`)
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage("Enter the email address used to create your account before requesting a new link.")
      return
    }

    if (!isCaptchaConfigured) {
      setErrorMessage("Security check is not configured, so confirmation email resend is not available yet.")
      return
    }

    setErrorMessage("")
    setStatusMessage("")
    setConfirmationPending(true)
    submitAfterCaptchaRef.current = false
    resendAfterCaptchaRef.current = { email: normalizedEmail, next }
    setCaptchaToken("")
    setCaptchaResetKey((current) => current + 1)
    setCaptchaDialogOpen(true)
  }

  async function handleProviderClick(provider: OAuthProviderKey) {
    if (loadingProvider) return
    if (!termsAccepted || !ageAttested) {
      setErrorMessage("Accept the draft Terms and Privacy framework and confirm age eligibility before social sign-in.")
      return
    }
    setLoadingProvider(provider)
    setErrorMessage("")
    setStatusMessage("")

    try {
      await startOAuthSignIn(provider, next, termsAccepted, ageAttested, navigator.language)
    } catch (error) {
      setLoadingProvider(null)
      setErrorMessage(error instanceof Error ? error.message : "Unable to start sign in.")
    }
  }

  return (
    <main className="casino-auth-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="lobby-ambient-orb absolute left-0 top-0 h-80 w-80 rounded-full blur-3xl" />
        <div className="lobby-ambient-orb lobby-ambient-orb-secondary absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="casino-auth-showcase relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(29,188,130,0.14),transparent_0_28%)]" />
          <div className="casino-auth-showcase-grid absolute inset-0 opacity-80" />

          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="casino-auth-card-face fortune-card-float absolute left-[19%] top-[27%] flex h-44 w-32 rotate-[-11deg] items-center justify-center rounded-[1.7rem] text-[4.2rem] text-primary/90">
              A
            </div>
            <div className="casino-auth-card-face fortune-card-float-delayed absolute left-[54%] top-[37%] flex h-44 w-32 rotate-[6deg] items-center justify-center rounded-[1.7rem] text-[4.2rem] text-[#ff3b45]">
              K
            </div>
            <div className="casino-auth-card-face fortune-card-float-slow absolute left-[28%] top-[58%] flex h-44 w-32 rotate-[10deg] items-center justify-center rounded-[1.7rem] text-[4.2rem] text-primary/90">
              Q
            </div>
          </div>

          <div className="relative z-10 flex h-full w-full flex-col justify-between px-10 py-8 xl:px-14 xl:py-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-primary/20 bg-primary/12 text-primary shadow-[0_0_30px_rgba(29,188,130,0.12)]">
                <Spade className="h-6 w-6" />
              </div>
              <div>
                <p className="font-serif text-[2rem] font-semibold tracking-tight text-[var(--auth-showcase-foreground)]">TaihuCasino</p>
                <p className="text-sm tracking-[0.22em] text-primary/70">MEMBER CLUB</p>
              </div>
            </div>

            <div className="max-w-[32rem]">
              <h1 className="font-serif text-[clamp(3rem,4.1vw,4.6rem)] leading-[0.98] font-semibold tracking-tight text-[var(--auth-showcase-foreground)]">
                Where Elegance
                <br />
                Meets Fortune
              </h1>
              <p className="mt-6 max-w-[31rem] text-[1.02rem] leading-8 text-[var(--auth-showcase-muted)]">
                A casino-themed leisure game built around virtual tokens, understandable randomness,
                and calm play. No cash-out or real-world prize redemption.
              </p>
            </div>

            <div className="flex gap-8 border-t pt-6 border-[var(--auth-showcase-divider)]">
              {stats.map((item, index) => (
                <div
                  key={item.label}
                  className={cn("pr-8", index < stats.length - 1 && "border-r border-[var(--auth-showcase-divider)]")}
                >
                  <p className="text-[2.6rem] font-semibold tracking-tight text-[var(--auth-showcase-foreground)]">{item.value}</p>
                  <p className="mt-1.5 text-base text-[var(--auth-showcase-muted)]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="casino-auth-form-shell relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-24 sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,188,130,0.08),transparent_0_24%)]" />

          <div className="casino-auth-panel relative z-10 w-full max-w-[33rem] rounded-[2rem] p-6 sm:p-8">
            <div className="mb-7 text-center lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-primary/20 bg-primary/12 text-primary">
                  <Spade className="h-5 w-5" />
                </div>
                <span className="font-serif text-2xl font-semibold text-foreground">TaihuCasino</span>
              </Link>
            </div>

            <div className="casino-auth-heading text-center">
              <h2 className="font-serif text-[2.55rem] font-semibold tracking-tight text-foreground">
                {isRegisterMode ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="mt-2.5 text-base text-[var(--auth-soft-text)]">
                {isRegisterMode ? "Create your Taihu member profile" : "Sign in to continue your gaming journey"}
              </p>
            </div>

            <div className="casino-auth-mode-tabs mt-6 grid grid-cols-2 rounded-[1.25rem] border border-primary/15 bg-background/45 p-1">
              <button
                type="button"
                onClick={() => switchAuthMode("sign-in")}
                className={cn(
                  "h-11 rounded-[1rem] text-sm font-semibold transition",
                  !isRegisterMode ? "bg-primary text-primary-foreground shadow-sm" : "text-[var(--auth-soft-text)] hover:text-foreground",
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchAuthMode("register")}
                className={cn(
                  "h-11 rounded-[1rem] text-sm font-semibold transition",
                  isRegisterMode ? "bg-primary text-primary-foreground shadow-sm" : "text-[var(--auth-soft-text)] hover:text-foreground",
                )}
              >
                Create account
              </button>
            </div>

            {testAccount && !isRegisterMode ? (
              <div className="casino-auth-test-account mt-6 rounded-[1.35rem] border border-primary/20 bg-primary/10 p-4 text-left">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Test account</p>
                    <p className="mt-1 text-xs text-[var(--auth-soft-text)]">
                      {testAccount.account} / {testAccount.password}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleUseTestAccount}>
                    Fill account
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="casino-auth-consent mt-6 space-y-3 rounded-[1.2rem] border border-primary/15 bg-background/50 px-4 py-4 text-sm text-[var(--auth-soft-text)]">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
                <span>I accept the draft <Link href="/terms" className="text-primary underline">Terms</Link> and <Link href="/privacy" className="text-primary underline">Privacy framework</Link>.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={ageAttested} onChange={(event) => setAgeAttested(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
                <span>I confirm that I meet the age requirement applicable in my location. The final numeric threshold is pending jurisdiction review.</span>
              </label>
            </div>

            <div className="casino-auth-providers mt-5 grid grid-cols-4 gap-3">
              {providerButtons.map((provider) => (
                <ProviderButton
                  key={provider.key}
                  label={provider.label}
                  className={provider.className}
                  src={provider.src}
                  imgClassName={provider.imgClassName}
                  width={provider.width}
                  height={provider.height}
                  loading={loadingProvider === provider.key}
                  disabled={loadingProvider !== null}
                  onClick={() => handleProviderClick(provider.key)}
                />
              ))}
            </div>

            <p className="casino-auth-desktop-optional mt-4 text-center text-sm leading-6 text-[var(--auth-soft-text)]">
              First-time social sign-in automatically creates a Taihu member profile.
            </p>

            <div className="casino-auth-desktop-optional my-7 flex items-center gap-4 text-sm text-[var(--auth-faint-text)]">
              <div className="h-px flex-1 bg-[var(--auth-divider)]" />
              <span className="text-base">{isRegisterMode ? "or create with email" : "or continue with email"}</span>
              <div className="h-px flex-1 bg-[var(--auth-divider)]" />
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="casino-auth-email-form space-y-4">
              {isRegisterMode ? (
                <Field
                  id="displayName"
                  label="Player Name"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Choose your member name"
                  autoComplete="name"
                  icon={<UserPlus className="h-5 w-5" />}
                />
              ) : null}

              <Field
                id="email"
                label="Email Address"
                type="text"
                value={email}
                onChange={setEmail}
                placeholder="Enter your email"
                autoComplete="email"
                icon={<Mail className="h-5 w-5" />}
              />

              <Field
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                icon={<Lock className="h-5 w-5" />}
                action={
                  !isRegisterMode ? (
                  <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
                    Forgot password?
                  </Link>
                  ) : null
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />

              {isRegisterMode ? (
                <Field
                  id="confirmPassword"
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  icon={<Lock className="h-5 w-5" />}
                />
              ) : null}

              <CaptchaDialog
                open={captchaDialogOpen}
                onOpenChange={handleCaptchaDialogOpenChange}
                token={captchaToken}
                onTokenChange={setCaptchaToken}
                resetKey={captchaResetKey}
              />

              {errorMessage ? (
                <div role="alert" className="rounded-[1.2rem] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {statusMessage || confirmationPending ? (
                <div role="status" className="rounded-[1.2rem] border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground">
                  <p>{statusMessage || "Email verification is still required before full member access."}</p>
                  {confirmationPending ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[var(--auth-soft-text)]">Allow a few minutes and check spam or junk mail before retrying.</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isResending || resendCooldownSeconds > 0}
                        onClick={handleResendConfirmation}
                        className="shrink-0"
                      >
                        <RefreshCw className={cn("mr-2 h-4 w-4", isResending && "animate-spin")} />
                        {isResending
                          ? "Sending..."
                          : resendCooldownSeconds > 0
                            ? `Retry in ${resendCooldownSeconds}s`
                            : "Resend confirmation"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting || isResending}
                className="mt-2 h-14 w-full rounded-[1.4rem] bg-primary text-lg font-semibold text-primary-foreground shadow-[0_20px_60px_rgba(45,201,142,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
              >
                {isSubmitting ? (isRegisterMode ? "Creating Account..." : "Signing In...") : isRegisterMode ? "Create Account" : "Sign In"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>

            {!confirmationPending ? (
              <p className="casino-auth-desktop-optional mt-5 text-center text-sm text-[var(--auth-soft-text)]">
                Waiting for email verification?{" "}
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending || resendCooldownSeconds > 0}
                  className="font-semibold text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending
                    ? "Sending confirmation..."
                    : resendCooldownSeconds > 0
                      ? `Resend available in ${resendCooldownSeconds}s`
                      : "Resend confirmation email"}
                </button>
              </p>
            ) : null}

            <p className="casino-auth-desktop-optional mt-7 text-center text-base text-[var(--auth-soft-text)]">
              {isRegisterMode ? "Already have an account?" : "New to TaihuCasino?"}{" "}
              <button
                type="button"
                onClick={() => switchAuthMode(isRegisterMode ? "sign-in" : "register")}
                className="font-semibold text-primary hover:text-primary/80"
              >
                {isRegisterMode ? "Sign in" : "Create a member profile"}
              </button>
            </p>

            <p className="casino-auth-desktop-optional mt-5 text-center text-xs leading-6 text-[var(--auth-faint-text)]">
              By using TaihuCasino, you acknowledge our draft{" "}
              <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                Privacy Policy
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
