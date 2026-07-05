import Link from "next/link"
import { ShieldCheck, Spade } from "lucide-react"

export function PasswordRecoveryShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="casino-auth-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="lobby-ambient-orb absolute left-0 top-0 h-80 w-80 rounded-full blur-3xl" />
        <div className="lobby-ambient-orb lobby-ambient-orb-secondary absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="casino-auth-showcase relative hidden overflow-hidden lg:flex">
          <div className="casino-auth-showcase-grid absolute inset-0 opacity-80" />
          <div className="relative z-10 flex w-full flex-col justify-between px-12 py-12 xl:px-16">
            <Link href="/" className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-primary/20 bg-primary/12 text-primary">
                <Spade className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-serif text-[2rem] font-semibold text-[var(--auth-showcase-foreground)]">TaihuCasino</span>
                <span className="block text-sm tracking-[0.22em] text-primary/70">MEMBER CLUB</span>
              </span>
            </Link>

            <div className="max-w-[32rem]">
              <ShieldCheck className="mb-7 h-12 w-12 text-primary" />
              <h1 className="font-serif text-[clamp(3rem,4.1vw,4.6rem)] font-semibold leading-[0.98] tracking-tight text-[var(--auth-showcase-foreground)]">
                A secure way
                <br />
                back to play
              </h1>
              <p className="mt-6 text-[1.02rem] leading-8 text-[var(--auth-showcase-muted)]">
                Reset links are time-limited. We never ask for your current password in an email.
              </p>
            </div>

            <p className="border-t border-[var(--auth-showcase-divider)] pt-6 text-sm text-[var(--auth-showcase-muted)]">
              Virtual tokens only. No cash-out or real-world prize redemption.
            </p>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="casino-auth-panel relative z-10 w-full max-w-[31rem] rounded-[2rem] p-6 sm:p-9">
            <Link href="/" className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-primary/20 bg-primary/12 text-primary">
                <Spade className="h-5 w-5" />
              </span>
              <span className="font-serif text-2xl font-semibold text-foreground">TaihuCasino</span>
            </Link>

            <div className="text-center">
              <h2 className="font-serif text-[2.45rem] font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="mt-3 text-base leading-7 text-[var(--auth-soft-text)]">{description}</p>
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
