import type { Metadata } from "next"

import { ForgotPasswordForm } from "./forgot-password-form"

export const metadata: Metadata = {
  title: "Forgot password | TaihuCasino",
  description: "Request a secure password reset link for your TaihuCasino member account.",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return <ForgotPasswordForm invalidLink={params.error === "invalid_link"} />
}
