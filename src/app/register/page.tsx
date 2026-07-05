"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    if (!response.ok) {
      setError("Registration failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push("/documents");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-black">
      <div className="w-full max-w-md">
       
        <div className="mb-6 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <DocIcon />
          </span>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-black">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Start collaborating on documents in seconds
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Full name
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                  <UserIcon />
                </span>
                <Input
                  name="name"
                  placeholder="John Doe"
                  required
                  className="border-neutral-300 w-full pl-10 text-black focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Email address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                  <MailIcon />
                </span>
                <Input
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  required
                  className="border-neutral-300 w-full pl-10 text-black focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                  <LockIcon />
                </span>
                <Input
                  name="password"
                  type="password"
                  placeholder="Create a strong password"
                  required
                  className="border-neutral-300 pl-10 w-full text-black focus-visible:ring-indigo-500"
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-400">
                Use at least 8 characters with a mix of letters and numbers.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <WarningIcon />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function DocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}