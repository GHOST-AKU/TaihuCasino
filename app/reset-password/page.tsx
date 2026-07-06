import type { Metadata } from "next"

import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = {
  title: "Set new password | TaihuCasino",
  description: "Choose a new password for your TaihuCasino member account.",
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
