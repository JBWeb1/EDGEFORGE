import type { Metadata } from "next";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : undefined} />;
}
