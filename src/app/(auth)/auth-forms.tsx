"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { signIn, signUp } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, {} as FormState);
  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-white">Sign in</h1>
      <p className="mb-6 text-sm text-navy-300">Welcome back. Your journal is waiting.</p>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email" errors={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" errors={state.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage state={state} />
        <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-300">
        New to EDGEFORGE? <Link href="/sign-up" className="text-electric-soft hover:underline">Create an account</Link>
      </p>
    </Card>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {} as FormState);
  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-white">Create your account</h1>
      <p className="mb-6 text-sm text-navy-300">Free manual journaling and core statistics.</p>
      <form action={action} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="name" errors={state.errors?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email" errors={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters." errors={state.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <FormMessage state={state} />
        <Button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-navy-300">
        Already have an account? <Link href="/sign-in" className="text-electric-soft hover:underline">Sign in</Link>
      </p>
    </Card>
  );
}
