"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";

function getRoleRedirectPath(role: string): string {
  switch (role) {
    case "super_admin":
      return "/dashboard/super-admin";
    case "school_admin":
      return "/school-admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    case "parent":
      return "/parent";
    default:
      return "/";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [magicLinkState, setMagicLinkState] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [magicLinkError, setMagicLinkError] = useState("");

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (!tokenHash || type !== "magiclink") {
      return;
    }

    const verifyMagicLink = async () => {
      setMagicLinkState("verifying");

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: tokenHash,
        });

        if (error) {
          throw error;
        }

        if (!data.user) {
          throw new Error("No user returned from magic link verification");
        }

        // Fetch the user profile to determine role
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Failed to determine user role");
        }

        setMagicLinkState("success");

        // Clear the token from the URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        const redirectPath = getRoleRedirectPath((profile as { role: string }).role);
        setTimeout(() => {
          window.location.href = redirectPath;
        }, 1000);
      } catch (err) {
        setMagicLinkState("error");
        setMagicLinkError(
          err instanceof Error ? err.message : "Failed to verify sign-in link. Please try again."
        );
      }
    };

    void verifyMagicLink();
  }, [searchParams, router]);

  // Show a progress state while verifying the magic link
  if (magicLinkState === "verifying") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Verifying sign-in link...</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Establishing your secure session.
          </p>
        </div>
      </div>
    );
  }

  if (magicLinkState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center shadow-xl dark:border-green-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sign-in successful!</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Redirecting you to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (magicLinkState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-xl dark:border-red-900 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Link verification failed</h1>
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>{magicLinkError}</AlertDescription>
            </Alert>
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                setMagicLinkState("idle");
              }}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <PortalLoginShell />;
}