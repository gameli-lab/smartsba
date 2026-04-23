"use client";

import { useMemo, useState } from "react";
import { ArrowRight, HelpCircle, Lock, School, Shield, Sparkles, Users } from "lucide-react";
import { AuthService, MultipleSchoolsFoundError, SchoolOption } from "@/lib/auth";
import { getClientCsrfHeaders } from "@/lib/csrf";
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

export function PortalLoginShell() {
  const [selectedTab, setSelectedTab] = useState<"auth" | "admin">("auth");
  const [authRole, setAuthRole] = useState<AuthRole>("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [wardAdmissionNumber, setWardAdmissionNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<SchoolOption[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotRole, setForgotRole] = useState<AuthRole>("student");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotSchool, setForgotSchool] = useState("");
  const [forgotWardAdmissionNumber, setForgotWardAdmissionNumber] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  const identifierLabel = useMemo(() => getIdentifierLabel(authRole), [authRole]);
  const identifierPlaceholder = useMemo(() => getIdentifierPlaceholder(authRole), [authRole]);
  const forgotIdentifierLabel = useMemo(() => getIdentifierLabel(forgotRole), [forgotRole]);
  const forgotIdentifierPlaceholder = useMemo(() => getIdentifierPlaceholder(forgotRole), [forgotRole]);

  const mapAuthRoleToApiRole = (role: AuthRole): "teacher" | "student" | "parent" => {
    if (role === "staff") {
      return "teacher";
    }

    return role;
  };

  const handleAuthSubmit = async (e?: React.FormEvent, schoolIdOverride?: string) => {
    e?.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let resolvedSchoolId: string | undefined = schoolIdOverride;
      const trimmedIdentifier = identifier.trim();
      const trimmedWardAdmission = wardAdmissionNumber.trim();

      if (selectedSchool && !schoolIdOverride) {
        resolvedSchoolId = (await SchoolService.resolveSchoolId(selectedSchool)) ?? undefined;
        if (!resolvedSchoolId) {
          throw new Error("School not found. Enter the exact registered school name or ID.");
        }
      }

      const loginResult = await AuthService.login({
        identifier: trimmedIdentifier,
        password,
        role: mapAuthRoleToApiRole(authRole),
        schoolId: resolvedSchoolId,
        wardAdmissionNumber: authRole === "parent" ? trimmedWardAdmission : undefined,
        rememberMe,
      });

      if (!loginResult?.profile) {
        throw new Error("Login failed - no profile returned");
      }

      switch (loginResult.profile.role) {
        case "school_admin":
          window.location.href = "/mfa-challenge?next=%2Fschool-admin";
          break;
        case "teacher":
          window.location.href = "/teacher";
          break;
        case "student":
          window.location.href = "/student";
          break;
        case "parent":
          window.location.href = "/parent";
          break;
        default:
          window.location.href = "/";
      }
    } catch (err) {
      if (err instanceof MultipleSchoolsFoundError) {
        setAvailableSchools(err.schools);
        setShowSchoolDialog(true);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchoolSelected = async (schoolId: string) => {
    setShowSchoolDialog(false);
    await handleAuthSubmit(undefined, schoolId);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);
    setAdminError("");

    try {
      const result = await AuthService.login({
        identifier: adminEmail,
        password: adminPassword,
        role: "super_admin",
        rememberMe,
      });

      if (!result?.profile) {
        throw new Error("Login failed - no profile returned");
      }

      window.location.href = "/mfa-challenge?next=%2Fdashboard%2Fsuper-admin";
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const resetForgotPasswordForm = () => {
    setForgotRole("student");
    setForgotIdentifier("");
    setForgotSchool("");
    setForgotWardAdmissionNumber("");
    setForgotError("");
    setForgotSuccess("");
    setIsForgotSubmitting(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    setIsForgotSubmitting(true);

    try {
      const trimmedSchool = forgotSchool.trim();
      const trimmedIdentifier = forgotIdentifier.trim();
      const trimmedWard = forgotWardAdmissionNumber.trim();

      if (!trimmedSchool) {
        throw new Error("Please enter your school name or ID.");
      }

      if (!trimmedIdentifier) {
        throw new Error("Please enter your identifier.");
      }

      if (forgotRole === "parent" && !trimmedWard) {
        throw new Error("Ward admission number is required for parent password reset requests.");
      }

      const resolvedSchoolId = await SchoolService.resolveSchoolId(trimmedSchool);

      if (!resolvedSchoolId) {
        throw new Error("School not found. Enter the exact registered school name or ID.");
      }

      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: getClientCsrfHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          identifier: trimmedIdentifier,
          role: mapAuthRoleToApiRole(forgotRole),
          schoolId: resolvedSchoolId,
          wardAdmissionNumber: forgotRole === "parent" ? trimmedWard : undefined,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit password reset request.");
      }

      setForgotSuccess(payload.message || "Password reset request submitted for admin approval.");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsForgotSubmitting(false);
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
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Select your account role to proceed</p>
                    </div>

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
                  </div>

                  <form className="space-y-5" onSubmit={handleAuthSubmit}>
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
                      <p className="text-xs text-slate-500 dark:text-slate-400">If left blank, the system will attempt to auto-detect the school after identity verification.</p>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                          Password
                        </Label>
                        <button
                          type="button"
                          className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-700 hover:text-slate-900 dark:text-sky-300 dark:hover:text-slate-100"
                          onClick={() => {
                            setForgotError("");
                            setForgotSuccess("");
                            setShowForgotPasswordModal(true);
                          }}
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
                        <Lock className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-slate-100"
                      />
                      <span>
                        Remember Me
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          Keep me signed in on this device after browser restart.
                        </span>
                      </span>
                    </label>

                    <div className="pt-3">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="h-14 w-full rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-base font-bold text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <span className="flex items-center justify-center gap-3">
                          {isLoading ? "Signing In..." : "Access Portal"}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Button>
                    </div>
                  </form>

                  <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                    Don&apos;t have access? <a className="font-bold text-sky-700 hover:underline dark:text-sky-300" href="#">Contact System Administrator</a>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-6 outline-none">
                  <div className="space-y-2 text-center lg:text-left">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">SysAdmin Login</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Email-based access for platform administrators</p>
                  </div>

                  {adminError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{adminError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <form className="space-y-5" onSubmit={handleAdminSubmit}>
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
                      <Label htmlFor="adminPassword" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                        Password
                      </Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-slate-100"
                      />
                      <span>
                        Remember Me
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          Keep me signed in on this device after browser restart.
                        </span>
                      </span>
                    </label>

                    <Button
                      type="submit"
                      disabled={isAdminLoading}
                      className="h-14 w-full rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-base font-bold text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <span className="flex items-center justify-center gap-3">
                        {isAdminLoading ? "Signing In..." : "Access Portal"}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Button>
                  </form>

                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200">
                    <p className="mb-2 font-semibold">Need to reset your password?</p>
                    <p>
                      SysAdmins must reset their password via the Supabase project dashboard.
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
          onSelect={handleSchoolSelected}
          isLoading={isLoading}
        />
      )}

      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Login help</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300">
              Use your assigned identifier and password. If you are a student, teacher, or parent, the system can auto-detect your school after identity verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>• Students: Admission number + password</p>
            <p>• Staff (Teacher / School Admin): Staff ID + password</p>
            <p>• Parents: Parent name or email + ward admission number + password</p>
            <p>• SysAdmin: Email + password</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showForgotPasswordModal}
        onOpenChange={(open) => {
          setShowForgotPasswordModal(open);
          if (!open) {
            resetForgotPasswordForm();
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Reset Your Password</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300">
              Enter your details to request a password reset. Your school admin will approve the request before a reset link is sent to your email.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleForgotPasswordSubmit}>
            {forgotError ? (
              <Alert variant="destructive">
                <AlertDescription>{forgotError}</AlertDescription>
              </Alert>
            ) : null}

            {forgotSuccess ? (
              <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                <AlertDescription>{forgotSuccess}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Role</Label>
              <div className="grid grid-cols-3 gap-2">
                {roleCards.map((item) => {
                  const active = forgotRole === item.role;
                  return (
                    <button
                      key={`forgot-${item.role}`}
                      type="button"
                      onClick={() => {
                        setForgotRole(item.role);
                        setForgotError("");
                        setForgotSuccess("");
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-school" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                School Name or ID
              </Label>
              <Input
                id="forgot-school"
                value={forgotSchool}
                onChange={(e) => setForgotSchool(e.target.value)}
                placeholder="Enter your school name or code"
                className="h-11 rounded-xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-identifier" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                {forgotIdentifierLabel}
              </Label>
              <Input
                id="forgot-identifier"
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                placeholder={forgotIdentifierPlaceholder}
                className="h-11 rounded-xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                required
              />
            </div>

            {forgotRole === "parent" ? (
              <div className="space-y-2">
                <Label htmlFor="forgot-ward" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                  Ward Admission Number
                </Label>
                <Input
                  id="forgot-ward"
                  value={forgotWardAdmissionNumber}
                  onChange={(e) => setForgotWardAdmissionNumber(e.target.value)}
                  placeholder="ADM-000-000"
                  className="h-11 rounded-xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  required
                />
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={() => setShowForgotPasswordModal(false)}
                disabled={isForgotSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={isForgotSubmitting}>
                {isForgotSubmitting ? "Requesting..." : "Request Reset"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
