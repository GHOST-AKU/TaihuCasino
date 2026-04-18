import Link from 'next/link'
import { Spade } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
        <Spade className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold">Authentication Error</h1>
      <p className="mt-2 text-center text-muted-foreground">
        Something went wrong during authentication. Please try again.
      </p>
      <Button asChild className="mt-6">
        <Link href="/login">Back to Login</Link>
      </Button>
    </div>
  )
}
