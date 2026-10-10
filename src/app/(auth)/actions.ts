"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/validation";

/** Only allow redirects to paths on this site. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError) return { message: e.message || "Could not create your account." };
    throw e;
  }
  redirect("/accounts?welcome=1");
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError) return { message: "Incorrect email or password." };
    throw e;
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
