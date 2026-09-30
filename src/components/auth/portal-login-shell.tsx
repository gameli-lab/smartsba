"use client";

import { useMemo, useState } from "react";
import { ArrowRight, HelpCircle, Link2, Lock, Mail, MessageSquareText, School, Shield, Sparkles, Users } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { SchoolService } from "@/lib/schools";
import { SchoolSelectionDialog } from "@/components/auth/SchoolSelectionDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AuthRole = "student" | "staff" | "parent";

type OtpStage = "send" | "verify";

type DeliveryChannel = "sms" | "email";

const roleCards: Array<{
  role: AuthRole;
  label: string;
  icon: React.ReactNode;
}> = [
  { role: "student", label: "Student", icon: <School className="h-5 w-5" /> },
  { role: "staff", label: "Staff", icon: <Users className="h-5 w-5" /> },
  { role: "parent", label: "Parent", icon: <Sparkles className="h-5 w-5" /> },
];

function getIdentifierLabel(role: AuthRole) {
  switch (role) {
    case "staff":
      return "Staff ID";
    case "student":
      return "Admission Number";
    case "parent":
      return "Parent Name or Email";
    default:
      return "Identifier";
  }
}

function getIdentifierPlaceholder(role: AuthRole) {
  switch (role) {
    case "staff":
      return "STAFF001";
    case "student":
      return "ADM-000-000";
    case "parent":
      return "John Doe or parent@example.com";
    default:
      return "";
  }
}

function mapAuthRoleToApiRole(role: AuthRole): "teacher" | "student" | "parent" {
  if (role === "staff") {
    return "teacher";
  }

  return role;
}

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

export function PortalLoginShell() {
  const [selectedTab, setSelectedTab] = useState<"auth" | "admin">("auth");
  const [authRole, setAuthRole] = useState<AuthRole>("student");
  const [identifier, setIdentifier] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [wardAdmissionNumber, setWardAdmissionNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [otpStage, setOtpStage] = useState<OtpStage>("send");
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("sms");
  const [otpRequestId, setOtpRequestId] = useState("");
  const [otpPrefix, setOtpPrefix] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null);
  const [otpMessage, setOtpMessage] = useState("");
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState("");

  // Admin OTP state
  const [adminOtpStage, setAdminOtpStage] = useState<OtpStage>("send");
  const [adminDeliveryChannel, setAdminDeliveryChannel] = useState<DeliveryChannel>("sms");
  const [adminOtpRequestId, setAdminOtpRequestId] = useState("");
  const [adminOtpPrefix, setAdminOtpPrefix] = useState("");
  const [adminOtpCode, setAdminOtpCode] = useState("");
  const [adminOtpAttemptsRemaining, setAdminOtpAttemptsRemaining] = useState<number | null>(null);
  const [adminOtpMessage, setAdminOtpMessage] = useState("");
  const [isAdminMagicLinkLoading, setIsAdminMagicLinkLoading] = useState(false);
  const [adminMagicLinkMessage, setAdminMagicLinkMessage] = useState("");

  // Admin state
  const [adminEmail, setAdminEmail] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const identifierLabel = useMemo(() => getIdentifierLabel(authRole), [authRole]);
  const identifierPlaceholder = useMemo(() => getIdentifierPlaceholder(authRole), [authRole]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError("");
    setOtpMessage("");

    try {
      const trimmedIdentifier = identifier.trim();
      const trimmedWardAdmission = wardAdmissionNumber.trim();

      if (!trimmedIdentifier) {
        throw new Error(`Please enter your ${identifierLabel.toLowerCase()}.`);
      }

      if (authRole === "parent" && !trimmedWardAdmission) {
        throw new Error("Ward admission number is required for parent login.");
      }

      let resolvedSchoolId: string | undefined = undefined;

      if (selectedSchool) {
        resolvedSchoolId = (await SchoolService.resolveSchoolId(selectedSchool)) ?? undefined;
        if (!resolvedSchoolId) {
          throw new Error("School not found. Enter the exact registered school name or ID.");
        }
      }

      const result = await AuthService.requestPasswordlessOtp({
        identifier: trimmedIdentifier,
        role: mapAuthRoleToApiRole(authRole),
        schoolId: resolvedSchoolId,
        wardAdmissionNumber: authRole === "parent" ? trimmedWardAdmission : undefined,
        channel: deliveryChannel,
      });

      if (deliveryChannel === "sms") {
        if (!result.requestId || !result.prefix) {
          throw new Error("OTP request failed - missing session data.");
        }
        setOtpRequestId(result.requestId);
        setOtpPrefix(result.prefix);
      } else {
        // Email OTP doesn't need requestId/prefix
        setOtpRequestId("");
        setOtpPrefix("");
      }

      if (result.expiresAt) {
        setOtpExpiresAt(result.expiresAt);
      }
      setOtpStage("verify");
      setOtpMessage(
        deliveryChannel === "sms"
          ? "A verification code has been sent to your phone via SMS."
          : "A verification code has been sent to your email address."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError("");
    setOtpMessage("");

    try {
      if (deliveryChannel === "sms") {
        if (!otpCode || otpCode.length !== 4 || !/^\d+$/.test(otpCode)) {
          throw new Error("Enter the 4-digit code from the SMS.");
        }
        if (!otpPrefix || otpPrefix.length !== 4) {
          throw new Error("Enter the 4-character prefix from the SMS.");
        }
      } else {
        if (!otpCode || otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
          throw new Error("Enter the 6-digit code from your email.");
        }
      }

      const result = await AuthService.verifyPasswordlessOtp({
        requestId: deliveryChannel === "sms" ? otpRequestId : undefined,
        prefix: deliveryChannel === "sms" ? otpPrefix : undefined,
        code: otpCode,
        role: mapAuthRoleToApiRole(authRole),
        identifier: deliveryChannel === "email" ? identifier.trim() : undefined,
        channel: deliveryChannel,
      });

      if (!result.user?.role) {
        throw new Error("Login failed - no role returned.");
      }

      setOtpMessage("OTP verified! Redirecting...");

      const redirectPath = getRoleRedirectPath(result.user.role);
      window.location.href = redirectPath;
    } catch (err) {
      const typedError = err as Error & { attemptsRemaining?: number };
      if (typeof typedError.attemptsRemaining === "number") {
        setOtpAttemptsRemaining(typedError.attemptsRemaining);
      }
      setError(typedError.message || "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setError("");
    setOtpMessage("");

    try {
      if (deliveryChannel === "sms") {
        const result = await AuthService.resendPasswordlessOtp(otpRequestId, mapAuthRoleToApiRole(authRole));
        setOtpMessage(result.message || "OTP resent to your phone.");
      } else {
        // For email resend, just re-trigger the send flow
        await handleSendOtp();
        return;
      }
      setOtpCode("");
      setOtpAttemptsRemaining(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setIsMagicLinkLoading(true);
    setError("");
    setMagicLinkMessage("");

    try {
      const trimmedIdentifier = identifier.trim();
      const trimmedWardAdmission = wardAdmissionNumber.trim();

      if (!trimmedIdentifier) {
        throw new Error(`Please enter your ${identifierLabel.toLowerCase()}.`);
      }

      if (authRole === "parent" && !trimmedWardAdmission) {
        throw new Error("Ward admission number is required for parent login.");
      }

      let resolvedSchoolId: string | undefined = undefined;

      if (selectedSchool) {
        resolvedSchoolId = (await SchoolService.resolveSchoolId(selectedSchool)) ?? undefined;
        if (!resolvedSchoolId) {
          throw new Error("School not found. Enter the exact registered school name or ID.");
        }
      }

      const result = await AuthService.requestMagicLink({
        identifier: trimmedIdentifier,
        role: mapAuthRoleToApiRole(authRole),
        schoolId: resolvedSchoolId,
        wardAdmissionNumber: authRole === "parent" ? trimmedWardAdmission : undefined,
      });

      setMagicLinkMessage(result.message || "Sign-in link sent to your email address. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const handleAdminSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsAdminLoading(true);
    setAdminError("");
    setAdminOtpMessage("");

    try {
      const trimmedEmail = adminEmail.trim();

      if (!trimmedEmail) {
        throw new Error("Please enter your admin email.");
      }

      const result = await AuthService.requestPasswordlessOtp({
        identifier: trimmedEmail,
        role: "super_admin",
        channel: adminDeliveryChannel,
      });

      if (adminDeliveryChannel === "sms") {
        if (!result.requestId || !result.prefix) {
          throw new Error("OTP request failed - missing session data.");
        }
        setAdminOtpRequestId(result.requestId);
        setAdminOtpPrefix(result.prefix);
      } else {
        setAdminOtpRequestId("");
        setAdminOtpPrefix("");
      }

      setAdminOtpStage("verify");
      setAdminOtpMessage(
        adminDeliveryChannel === "sms"
          ? "A verification code has been sent to your phone via SMS."
          : "A verification code has been sent to your email address."
      );
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleAdminVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsAdminLoading(true);
    setAdminError("");
    setAdminOtpMessage("");

    try {
      if (adminDeliveryChannel === "sms") {
        if (!adminOtpCode || adminOtpCode.length !== 4 || !/^\d+$/.test(adminOtpCode)) {
          throw new Error("Enter the 4-digit code from the SMS.");
        }
        if (!adminOtpPrefix || adminOtpPrefix.length !== 4) {
          throw new Error("Enter the 4-character prefix from the SMS.");
        }
      } else {
        if (!adminOtpCode || adminOtpCode.length !== 6 || !/^\d+$/.test(adminOtpCode)) {
          throw new Error("Enter the 6-digit code from your email.");
        }
      }

      const result = await AuthService.verifyPasswordlessOtp({
        requestId: adminDeliveryChannel === "sms" ? adminOtpRequestId : undefined,
        prefix: adminDeliveryChannel === "sms" ? adminOtpPrefix : undefined,
        code: adminOtpCode,
        role: "super_admin",
        identifier: adminDeliveryChannel === "email" ? adminEmail.trim() : undefined,
        channel: adminDeliveryChannel,
      });

      if (!result.user?.role) {
        throw new Error("Login failed - no role returned.");
      }

      setAdminOtpMessage("OTP verified! Redirecting...");

      const redirectPath = getRoleRedirectPath(result.user.role);
      window.location.href = redirectPath;
    } catch (err) {
      const typedError = err as Error & { attemptsRemaining?: number };
      if (typeof typedError.attemptsRemaining === "number") {
        setAdminOtpAttemptsRemaining(typedError.attemptsRemaining);
      }
      setAdminError(typedError.message || "Failed to verify OTP");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleAdminResendOtp = async () => {
    setIsAdminLoading(true);
    setAdminError("");
    setAdminOtpMessage("");

    try {
      if (adminDeliveryChannel === "sms") {
        const result = await AuthService.resendPasswordlessOtp(adminOtpRequestId, "super_admin");
        setAdminOtpMessage(result.message || "OTP resent to your phone.");
      } else {
        // For email resend, re-trigger the send flow
        await handleAdminSendOtp();
        return;
      }
      setAdminOtpCode("");
      setAdminOtpAttemptsRemaining(null);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#e0f2fe_0%,#f8fafc_55%,#e2e8f0_100%)] dark:bg-[linear-gradient(135deg,#001737_0%,#002b5d_100%)]" />
        <div className="absolute -left-8 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-300/10" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl dark:bg-sky-400/10" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <section className="hidden space-y-6 lg:col-span-5 lg:block">
            <div>
              <h1 className="max-w-md text-5xl font-extrabold leading-tight tracking-tight">
                Smart SBA <br />
                <span className="text-cyan-700 dark:text-cyan-300">System</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                Precision analytics for School-Based Assessments. Empowering educators,
                students, and parents with data-driven academic clarity.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="rounded-xl bg-cyan-400/15 p-2 text-cyan-700 dark:text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Real-time Progress</h3>
                  <p className="text-xs text-slate-600 dark:text-white/55">Track assessment milestones as they happen.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="rounded-xl bg-sky-400/15 p-2 text-sky-700 dark:text-sky-300">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Passwordless Access</h3>
                  <p className="text-xs text-slate-600 dark:text-white/55">Secure SMS verification. No passwords to remember.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="rounded-xl bg-emerald-400/15 p-2 text-emerald-700 dark:text-emerald-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Institutional Security</h3>
                  <p className="text-xs text-slate-600 dark:text-white/55">Enterprise-grade protection for student data.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_24px_60px_rgba(2,6,23,0.16)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
              <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "auth" | "admin")} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 rounded-full bg-slate-200/80 p-1 dark:bg-slate-800">
                  <TabsTrigger value="auth" className="rounded-full text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-slate-200 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-50">
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="rounded-full text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-slate-200 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-50">
                    SysAdmin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="auth" className="space-y-6 outline-none">
                  <div className="space-y-6">
                    <div className="text-center lg:text-left">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Identify Yourself</h2>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 rounded-full px-3 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                          onClick={() => setShowHelpModal(true)}
                        >
                          <HelpCircle className="mr-1 h-4 w-4" /> Need Help?
                        </Button>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {otpStage === "send"
                          ? "Select your account role to receive a one-time code via SMS or email"
                          : deliveryChannel === "sms"
                            ? "Enter the code sent to your phone"
                            : "Enter the code sent to your email"}
                      </p>
                    </div>

                    {otpStage === "send" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {roleCards.map((item) => {
                          const active = authRole === item.role;
                          return (
                            <button
                              key={item.role}
                              type="button"
                              onClick={() => setAuthRole(item.role)}
                              className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-300 ${
                                active
                                  ? "border-slate-900 bg-slate-900/5 dark:border-slate-200 dark:bg-slate-200/10"
                                  : "border-transparent bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                              }`}
                            >
                              <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform ${active ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
                                {item.icon}
                              </div>
                              <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-200"}`}>
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {otpStage === "send" ? (
                    <form className="space-y-5" onSubmit={handleSendOtp}>
                      {error ? (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="school" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          School Name or ID <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-400">(Optional)</span>
                        </Label>
                        <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                          <School className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                          <Input
                            id="school"
                            value={selectedSchool}
                            onChange={(e) => setSelectedSchool(e.target.value)}
                            placeholder="Enter institution name"
                            className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">If left blank, the system will attempt to auto-detect the school.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="identifier" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          {identifierLabel}
                        </Label>
                        <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                          <Users className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                          <Input
                            id="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={identifierPlaceholder}
                            className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      {authRole === "parent" && (
                        <div className="space-y-2">
                          <Label htmlFor="ward" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                            Ward Admission Number
                          </Label>
                          <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                            <School className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                            <Input
                              id="ward"
                              value={wardAdmissionNumber}
                              onChange={(e) => setWardAdmissionNumber(e.target.value)}
                              placeholder="ADM-000-000"
                              className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Delivery Method
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setDeliveryChannel("sms")}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all ${
                              deliveryChannel === "sms"
                                ? "border-slate-900 bg-slate-900/5 dark:border-slate-200 dark:bg-slate-200/10"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <MessageSquareText className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">SMS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryChannel("email")}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all ${
                              deliveryChannel === "email"
                                ? "border-slate-900 bg-slate-900/5 dark:border-slate-200 dark:bg-slate-200/10"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <Mail className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-3">
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="h-14 w-full rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-base font-bold text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <span className="flex items-center justify-center gap-3">
                            {isLoading ? "Sending Code..." : deliveryChannel === "sms" ? "Send OTP via SMS" : "Send OTP via Email"}
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </Button>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-3 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">or</span>
                        </div>
                      </div>

                      {magicLinkMessage ? (
                        <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                          <AlertDescription>{magicLinkMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleMagicLink}
                        disabled={isMagicLinkLoading}
                        className="h-12 w-full rounded-full border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Link2 className="h-4 w-4" />
                          {isMagicLinkLoading ? "Sending Link..." : "Sign in with Magic Link"}
                        </span>
                      </Button>
                    </form>
                  ) : (
                    <form className="space-y-5" onSubmit={handleVerifyOtp}>
                      {error ? (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}

                      {otpMessage ? (
                        <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                          <AlertDescription>{otpMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      {deliveryChannel === "sms" ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Your SMS contains a <span className="font-bold text-slate-900 dark:text-slate-100">4-character prefix</span> followed by a{" "}
                            <span className="font-bold text-slate-900 dark:text-slate-100">4-digit code</span>.
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Example: <span className="font-mono font-bold">ZDSQ 3824</span>
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Check your email for a <span className="font-bold text-slate-900 dark:text-slate-100">6-digit verification code</span>.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="otp-code" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Verification Code ({deliveryChannel === "sms" ? "4 digits" : "6 digits"})
                        </Label>
                        <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                          <Lock className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                          <Input
                            id="otp-code"
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, deliveryChannel === "sms" ? 4 : 6))}
                            placeholder={deliveryChannel === "sms" ? "0000" : "000000"}
                            inputMode="numeric"
                            maxLength={deliveryChannel === "sms" ? 4 : 6}
                            className="h-12 border-0 bg-transparent px-0 text-center text-2xl font-bold tracking-widest text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      {deliveryChannel === "sms" && (
                        <div className="space-y-2">
                          <Label htmlFor="otp-prefix" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                            Prefix (4 characters from SMS)
                          </Label>
                          <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                            <MessageSquareText className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                            <Input
                              id="otp-prefix"
                              type="text"
                              value={otpPrefix}
                              onChange={(e) => setOtpPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                              placeholder="ZDSQ"
                              maxLength={4}
                              className="h-12 border-0 bg-transparent px-0 text-center text-xl font-bold tracking-widest text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">The prefix and code were both sent to your phone.</p>
                        </div>
                      )}

                      {otpAttemptsRemaining !== null && (
                        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                            {otpAttemptsRemaining} attempt{otpAttemptsRemaining === 1 ? "" : "s"} remaining
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-3 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleResendOtp}
                          disabled={isLoading}
                          className="flex-1 h-12 rounded-full"
                        >
                          Resend Code
                        </Button>
                        <Button
                          type="submit"
                          disabled={isLoading || otpCode.length !== (deliveryChannel === "sms" ? 4 : 6) || (deliveryChannel === "sms" && otpPrefix.length !== 4)}
                          className="flex-1 h-12 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
                            {isLoading ? "Verifying..." : "Verify & Sign In"}
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </Button>
                      </div>

                      <div className="text-center">
                        <button
                          type="button"
                          className="text-xs font-bold uppercase tracking-[0.3em] text-sky-700 hover:text-slate-900 dark:text-sky-300 dark:hover:text-slate-100"
                          onClick={() => {
                            setOtpStage("send");
                            setOtpCode("");
                            setOtpPrefix("");
                            setError("");
                            setOtpMessage("");
                            setOtpAttemptsRemaining(null);
                            setDeliveryChannel("sms");
                          }}
                        >
                          ← Back to Identifier
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                    Don't have access? <a className="font-bold text-sky-700 hover:underline dark:text-sky-300" href="#">Contact System Administrator</a>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-6 outline-none">
                  <div className="space-y-2 text-center lg:text-left">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">SysAdmin Login</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {adminOtpStage === "send"
                        ? "Enter your email to receive a one-time code via SMS or email"
                        : adminDeliveryChannel === "sms"
                          ? "Enter the code sent to your phone"
                          : "Enter the code sent to your email"}
                    </p>
                  </div>

                  {adminError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{adminError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {adminOtpMessage ? (
                    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                      <AlertDescription>{adminOtpMessage}</AlertDescription>
                    </Alert>
                  ) : null}

                  {adminOtpStage === "send" ? (
                    <form className="space-y-5" onSubmit={handleAdminSendOtp}>
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Email
                        </Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@example.com"
                          className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Delivery Method
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setAdminDeliveryChannel("sms")}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all ${
                              adminDeliveryChannel === "sms"
                                ? "border-slate-900 bg-slate-900/5 dark:border-slate-200 dark:bg-slate-200/10"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <MessageSquareText className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">SMS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminDeliveryChannel("email")}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all ${
                              adminDeliveryChannel === "email"
                                ? "border-slate-900 bg-slate-900/5 dark:border-slate-200 dark:bg-slate-200/10"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <Mail className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isAdminLoading}
                        className="h-14 w-full rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-base font-bold text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <span className="flex items-center justify-center gap-3">
                          {isAdminLoading ? "Sending Code..." : adminDeliveryChannel === "sms" ? "Send OTP via SMS" : "Send OTP via Email"}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-3 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">or</span>
                        </div>
                      </div>

                      {adminMagicLinkMessage ? (
                        <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                          <AlertDescription>{adminMagicLinkMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          setIsAdminMagicLinkLoading(true);
                          setAdminError("");
                          setAdminMagicLinkMessage("");
                          try {
                            const result = await AuthService.requestMagicLink({
                              identifier: adminEmail.trim(),
                              role: "super_admin",
                            });
                            setAdminMagicLinkMessage(result.message || "Sign-in link sent to your email address.");
                          } catch (err) {
                            setAdminError(err instanceof Error ? err.message : "Failed to send magic link");
                          } finally {
                            setIsAdminMagicLinkLoading(false);
                          }
                        }}
                        disabled={isAdminMagicLinkLoading}
                        className="h-12 w-full rounded-full border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Link2 className="h-4 w-4" />
                          {isAdminMagicLinkLoading ? "Sending Link..." : "Sign in with Magic Link"}
                        </span>
                      </Button>
                    </form>
                  ) : (
                    <form className="space-y-5" onSubmit={handleAdminVerifyOtp}>
                      {adminDeliveryChannel === "sms" ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Your SMS contains a <span className="font-bold text-slate-900 dark:text-slate-100">4-character prefix</span> followed by a{" "}
                            <span className="font-bold text-slate-900 dark:text-slate-100">4-digit code</span>.
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Example: <span className="font-mono font-bold">ZDSQ 3824</span>
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Check your email for a <span className="font-bold text-slate-900 dark:text-slate-100">6-digit verification code</span>.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="admin-otp-code" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Verification Code ({adminDeliveryChannel === "sms" ? "4 digits" : "6 digits"})
                        </Label>
                        <Input
                          id="admin-otp-code"
                          type="text"
                          value={adminOtpCode}
                          onChange={(e) => setAdminOtpCode(e.target.value.replace(/\D/g, "").slice(0, adminDeliveryChannel === "sms" ? 4 : 6))}
                          placeholder={adminDeliveryChannel === "sms" ? "0000" : "000000"}
                          inputMode="numeric"
                          maxLength={adminDeliveryChannel === "sms" ? 4 : 6}
                          className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-center text-2xl font-bold tracking-widest text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {adminDeliveryChannel === "sms" && (
                        <div className="space-y-2">
                          <Label htmlFor="admin-otp-prefix" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                            Prefix (4 characters from SMS)
                          </Label>
                          <Input
                            id="admin-otp-prefix"
                            type="text"
                            value={adminOtpPrefix}
                            onChange={(e) => setAdminOtpPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                            placeholder="ZDSQ"
                            maxLength={4}
                            className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-center text-xl font-bold tracking-widest text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                          />
                        </div>
                      )}

                      {adminOtpAttemptsRemaining !== null && (
                        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                            {adminOtpAttemptsRemaining} attempt{adminOtpAttemptsRemaining === 1 ? "" : "s"} remaining
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAdminResendOtp}
                          disabled={isAdminLoading}
                          className="flex-1 h-12 rounded-full"
                        >
                          Resend Code
                        </Button>
                        <Button
                          type="submit"
                          disabled={isAdminLoading || adminOtpCode.length !== (adminDeliveryChannel === "sms" ? 4 : 6) || (adminDeliveryChannel === "sms" && adminOtpPrefix.length !== 4)}
                          className="flex-1 h-12 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold"
                        >
                          {isAdminLoading ? "Verifying..." : "Verify & Sign In"}
                        </Button>
                      </div>

                      <div className="text-center">
                        <button
                          type="button"
                          className="text-xs font-bold uppercase tracking-[0.3em] text-sky-700 hover:text-slate-900 dark:text-sky-300 dark:hover:text-slate-100"
                          onClick={() => {
                            setAdminOtpStage("send");
                            setAdminOtpCode("");
                            setAdminOtpPrefix("");
                            setAdminError("");
                            setAdminOtpMessage("");
                            setAdminOtpAttemptsRemaining(null);
                            setAdminDeliveryChannel("sms");
                          }}
                        >
                          ← Back to Email
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200">
                    <p className="mb-2 font-semibold">Passwordless Security</p>
                    <p>
                      SysAdmins verify their identity with a one-time code sent to their registered phone or email.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </div>
      </main>

      {showSchoolDialog && (
        <SchoolSelectionDialog
          schools={availableSchools}
          onSelect={(schoolId) => {
            setShowSchoolDialog(false);
            void handleSendOtp();
          }}
          isLoading={isLoading}
        />
      )}

      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Login help</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300">
              Use your assigned identifier to receive a one-time code via SMS or email. No passwords needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>• Students: Admission number → SMS or email code</p>
            <p>• Staff (Teacher / School Admin): Staff ID → SMS or email code</p>
            <p>• Parents: Parent name or email + ward admission number → SMS or email code</p>
            <p>• SysAdmin: Email → SMS or email code</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">SMS codes include a 4-character prefix + 4-digit code. Email codes are 6 digits.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">If SMS delivery fails, dial *713*90# from your registered phone as a backup to view your code.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Prefer not to enter a code? Use "Sign in with Magic Link" to receive a secure link via email.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
