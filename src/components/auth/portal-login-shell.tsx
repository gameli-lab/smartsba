"use client";

import { useMemo, useState } from "react";
import { ArrowRight, HelpCircle, Lock, School, Shield, Sparkles, Users } from "lucide-react";
import { AuthService, MultipleSchoolsFoundError, SchoolOption } from "@/lib/auth";
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

type AuthRole = "student" | "teacher" | "school_admin" | "parent";

const roleCards: Array<{
  role: AuthRole;
  label: string;
  icon: React.ReactNode;
}> = [
  { role: "student", label: "Student", icon: <School className="h-5 w-5" /> },
  { role: "teacher", label: "Teacher", icon: <Users className="h-5 w-5" /> },
  { role: "school_admin", label: "Admin", icon: <Shield className="h-5 w-5" /> },
  { role: "parent", label: "Parent", icon: <Sparkles className="h-5 w-5" /> },
];

function getIdentifierLabel(role: AuthRole) {
  switch (role) {
    case "school_admin":
    case "teacher":
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
    case "school_admin":
    case "teacher":
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

  const identifierLabel = useMemo(() => getIdentifierLabel(authRole), [authRole]);
  const identifierPlaceholder = useMemo(() => getIdentifierPlaceholder(authRole), [authRole]);

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
        role: authRole,
        schoolId: resolvedSchoolId,
        wardAdmissionNumber: authRole === "parent" ? trimmedWardAdmission : undefined,
      });

      if (!loginResult?.profile) {
        throw new Error("Login failed - no profile returned");
      }

      switch (loginResult.profile.role) {
        case "school_admin":
          window.location.href = "/school-admin";
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
      });

      if (!result?.profile) {
        throw new Error("Login failed - no profile returned");
      }

      window.location.href = "/dashboard/super-admin";
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08284f] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#001737_0%,#002b5d_100%)]" />
        <div className="absolute -left-8 top-0 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-6 lg:px-12 lg:py-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">SmartSBA</span>
          <span className="hidden h-6 w-px bg-white/20 md:block" />
          <span className="hidden text-[10px] uppercase tracking-[0.35em] text-white/60 md:block">Academic Excellence</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="gap-2 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          onClick={() => setShowHelpModal(true)}
        >
          <HelpCircle className="h-4 w-4" />
          Need Help?
        </Button>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4 pb-8 pt-2 sm:px-6 lg:px-12 lg:py-8">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <section className="hidden space-y-6 text-white lg:col-span-5 lg:block">
            <div>
              <h1 className="max-w-md text-5xl font-extrabold leading-tight tracking-tight">
                Smart SBA <br />
                <span className="text-cyan-300">System</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
                Precision analytics for School-Based Assessments. Empowering educators,
                students, and parents with data-driven academic clarity.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="rounded-xl bg-cyan-400/15 p-2 text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Real-time Progress</h3>
                  <p className="text-xs text-white/55">Track assessment milestones as they happen.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="rounded-xl bg-sky-400/15 p-2 text-sky-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Institutional Security</h3>
                  <p className="text-xs text-white/55">Enterprise-grade protection for student data.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-white/20 bg-white/88 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-8 lg:p-10">
              <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "auth" | "admin")} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 rounded-full bg-slate-200/70 p-1">
                  <TabsTrigger value="auth" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    Super Admin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="auth" className="space-y-6 outline-none">
                  <div className="space-y-6">
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Identify Yourself</h2>
                      <p className="mt-1 text-sm text-slate-600">Select your account role to proceed</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {roleCards.map((item) => {
                        const active = authRole === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => setAuthRole(item.role)}
                            className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-300 ${
                              active
                                ? "border-slate-900 bg-slate-900/5"
                                : "border-transparent bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform ${active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
                              {item.icon}
                            </div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? "text-slate-900" : "text-slate-700"}`}>
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
                      <Label htmlFor="school" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                        School Name or ID <span className="font-normal normal-case tracking-normal text-slate-400">(Optional)</span>
                      </Label>
                      <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20">
                        <School className="mr-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="school"
                          value={selectedSchool}
                          onChange={(e) => setSelectedSchool(e.target.value)}
                          placeholder="Enter institution name"
                          className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                        />
                      </div>
                      <p className="text-xs text-slate-500">If left blank, the system will attempt to auto-detect the school after identity verification.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="identifier" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                        {identifierLabel}
                      </Label>
                      <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20">
                        <Users className="mr-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="identifier"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder={identifierPlaceholder}
                          className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    {authRole === "parent" && (
                      <div className="space-y-2">
                        <Label htmlFor="ward" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                          Ward Admission Number
                        </Label>
                        <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20">
                          <School className="mr-3 h-4 w-4 text-slate-500" />
                          <Input
                            id="ward"
                            value={wardAdmissionNumber}
                            onChange={(e) => setWardAdmissionNumber(e.target.value)}
                            placeholder="ADM-000-000"
                            className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                          Password
                        </Label>
                        <button
                          type="button"
                          className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-700 hover:text-slate-900"
                          onClick={() => setShowHelpModal(true)}
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20">
                        <Lock className="mr-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                        />
                      </div>
                    </div>

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

                  <div className="text-center text-xs font-medium text-slate-500">
                    Don&apos;t have access? <a className="font-bold text-sky-700 hover:underline" href="#">Contact System Administrator</a>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-6 outline-none">
                  <div className="space-y-2 text-center lg:text-left">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Super Admin Login</h2>
                    <p className="text-sm text-slate-600">Email-based access for platform administrators</p>
                  </div>

                  {adminError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{adminError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <form className="space-y-5" onSubmit={handleAdminSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                        Email
                      </Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adminPassword" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                        Password
                      </Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 rounded-2xl border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400"
                      />
                    </div>

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

                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                    <p className="mb-2 font-semibold">Need to reset your password?</p>
                    <p>
                      Super Admins must reset their password via the Supabase project dashboard.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 px-4 pb-5 pt-3 text-[10px] uppercase tracking-[0.3em] text-white/45 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">SmartSBA</span>
            <span className="text-white/20">|</span>
            <span>© 2024 SmartSBA. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#" className="hover:text-cyan-200">Privacy Policy</a>
            <a href="#" className="hover:text-cyan-200">Terms of Service</a>
            <a href="#" className="hover:text-cyan-200">Security</a>
          </div>
        </div>
      </footer>

      {showSchoolDialog && (
        <SchoolSelectionDialog
          schools={availableSchools}
          onSelect={handleSchoolSelected}
          isLoading={isLoading}
        />
      )}

      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login help</DialogTitle>
            <DialogDescription>
              Use your assigned identifier and password. If you are a student, teacher, or parent, the system can auto-detect your school after identity verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600">
            <p>• Students: Admission number + password</p>
            <p>• Teachers / School Admin: Staff ID + password</p>
            <p>• Parents: Parent name or email + ward admission number + password</p>
            <p>• Super Admin: Email + password</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
