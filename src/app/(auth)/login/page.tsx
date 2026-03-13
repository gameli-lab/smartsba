"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthService, MultipleSchoolsFoundError, SchoolOption } from "@/lib/auth";
import { SchoolService, School } from "@/lib/schools";
import { UserRole } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchoolSelectionDialog } from "@/components/auth/SchoolSelectionDialog";
import Link from "next/link";

type AuthRole = "student" | "teacher" | "school_admin" | "parent";
type AdminRole = "super_admin";

export default function LoginPage() {
  // Main role selection: Auth roles vs Super Admin
  const [selectedTab, setSelectedTab] = useState<"auth" | "admin">("auth");
  
  // For Auth Users (Student, Teacher, School Admin, Parent)
  const [authRole, setAuthRole] = useState<AuthRole>("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [wardAdmissionNumber, setWardAdmissionNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // For Super Admin
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  
  // School Selection Dialog (Smart Discovery)
  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<SchoolOption[]>([]);
  const [pendingLoginData, setPendingLoginData] = useState<{
    role: AuthRole;
    wardAdmissionNumber?: string;
  } | null>(null);
  
  // Forgot Password Modal
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // --- Helper Functions ---

  const getIdentifierLabel = (selectedRole: AuthRole) => {
    switch (selectedRole) {
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
  };

  const getIdentifierPlaceholder = (selectedRole: AuthRole) => {
    switch (selectedRole) {
      case "school_admin":
      case "teacher":
        return "STAFF001";
      case "student":
        return "SBA2024001";
      case "parent":
        return "John Doe or parent@example.com";
      default:
        return "";
    }
  };

  const getAuthRoleDescription = (selectedRole: AuthRole) => {
    switch (selectedRole) {
      case "school_admin":
        return "School Administrator";
      case "teacher":
        return "Teacher / Staff Member";
      case "student":
        return "Student";
      case "parent":
        return "Parent / Guardian";
      default:
        return "";
    }
  };

  // --- Auth User Login Handler ---

  const handleAuthSubmit = async (e: React.FormEvent, schoolIdOverride?: string) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let resolvedSchoolId: string | undefined = schoolIdOverride;

      // Normalize identifier inputs to reduce user friction
      const trimmedIdentifier = identifier.trim();
      const trimmedWardAdmission = wardAdmissionNumber.trim();

      // If school provided manually, resolve it
      if (selectedSchool && !schoolIdOverride) {
        resolvedSchoolId = await SchoolService.resolveSchoolId(selectedSchool);
        if (!resolvedSchoolId) {
          throw new Error(
            "School not found. Enter the exact registered school name or ID."
          );
        }
      }

      const loginResult = await AuthService.login({
        identifier: trimmedIdentifier,
        password,
        role: authRole,
        schoolId: resolvedSchoolId,
        wardAdmissionNumber:
          authRole === "parent" ? trimmedWardAdmission : undefined,
      });

      if (!loginResult || !loginResult.profile) {
        throw new Error("Login failed - no profile returned");
      }

      // Hard navigation so the root layout (GlobalHeader) re-renders
      // server-side with the newly-set auth cookie. router.push() is a
      // soft navigation that reuses the cached layout and would leave the
      // header in the unauthenticated state until a manual refresh.
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
        // User's identifier is associated with multiple schools - show selection dialog
        setAvailableSchools(err.schools);
        setPendingLoginData({
          role: authRole,
          wardAdmissionNumber: authRole === "parent" ? wardAdmissionNumber : undefined,
        });
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
    // Retry login with selected school
    const e = new Event("submit");
    await handleAuthSubmit(e as any, schoolId);
  };

  // --- Super Admin Login Handler ---

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

      if (!result || !result.profile) {
        throw new Error("Login failed - no profile returned");
      }

      // Hard navigation — same reason as auth user handler above
      window.location.href = "/dashboard/super-admin";
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            Smart SBA System
          </h1>
          <p className="text-lg text-gray-600">
            School-Based Assessment Platform
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs
          value={selectedTab}
          onValueChange={(v) => setSelectedTab(v as "auth" | "admin")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="auth" className="text-base">
              User Login
            </TabsTrigger>
            <TabsTrigger value="admin" className="text-base">
              Super Admin
            </TabsTrigger>
          </TabsList>

          {/* User Login Tab */}
          <TabsContent value="auth" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <CardTitle>Select Your Role</CardTitle>
                <CardDescription className="text-blue-100">
                  Choose your role to continue with login
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Role Selection Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { role: "student" as AuthRole, label: "Student" },
                    { role: "teacher" as AuthRole, label: "Teacher" },
                    {
                      role: "school_admin" as AuthRole,
                      label: "School Admin",
                    },
                    { role: "parent" as AuthRole, label: "Parent" },
                  ].map((option) => (
                    <button
                      key={option.role}
                      onClick={() => {
                        setAuthRole(option.role);
                        setError("");
                        setIdentifier("");
                        setPassword("");
                        setSelectedSchool("");
                        setWardAdmissionNumber("");
                      }}
                      className={`p-4 rounded-lg border-2 transition-all font-medium text-center ${
                        authRole === option.role
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Role Description */}
                <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">
                    {getAuthRoleDescription(authRole)}
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* School Selection (Optional - for Smart Discovery) */}
                  <div className="space-y-2">
                    <Label htmlFor="school" className="font-semibold">
                      School Name or ID <span className="text-gray-500">(Optional)</span>
                    </Label>
                    <Input
                      id="school"
                      type="text"
                      placeholder="Enter your school name or code (optional)"
                      value={selectedSchool}
                      onChange={(e) =>
                        setSelectedSchool(e.target.value.trim())
                      }
                      className="border-gray-300"
                    />
                    <p className="text-xs text-gray-500">
                      Leave blank to auto-detect your school, or provide your school name/code for faster login.
                    </p>
                  </div>

                  {/* Identifier Field */}
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="font-semibold">
                      {getIdentifierLabel(authRole)} *
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder={getIdentifierPlaceholder(authRole)}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="border-gray-300"
                      required
                    />
                  </div>

                  {/* Ward Admission Number (Parents Only) */}
                  {authRole === "parent" && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="wardAdmissionNumber"
                        className="font-semibold"
                      >
                        Ward Admission Number *
                      </Label>
                      <Input
                        id="wardAdmissionNumber"
                        type="text"
                        placeholder="SBA2024001"
                        value={wardAdmissionNumber}
                        onChange={(e) =>
                          setWardAdmissionNumber(e.target.value)
                        }
                        className="border-gray-300"
                        required
                      />
                    </div>
                  )}

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-semibold">
                      Password *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-gray-300"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                {/* Forgot Password Link */}
                <div className="text-center mt-4">
                  <Dialog
                    open={showForgotPasswordModal}
                    onOpenChange={setShowForgotPasswordModal}
                  >
                    <DialogTrigger asChild>
                      <Button variant="link" className="text-blue-600">
                        Forgot Password?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <ForgotPasswordDialog
                        onClose={() => setShowForgotPasswordModal(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Super Admin Tab */}
          <TabsContent value="admin" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                <CardTitle>Super Admin Login</CardTitle>
                <CardDescription className="text-purple-100">
                  Exclusive administrator access
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  {adminError && (
                    <Alert variant="destructive">
                      <AlertDescription>{adminError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="font-semibold">
                      Email Address *
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@smartsba.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="border-gray-300"
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="font-semibold">
                      Password *
                    </Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="border-gray-300"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-6 font-semibold"
                    disabled={isAdminLoading}
                  >
                    {isAdminLoading ? "Signing in..." : "Sign In as Super Admin"}
                  </Button>
                </form>

                {/* Super Admin Help */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-900 font-medium mb-2">
                    Need to reset your password?
                  </p>
                  <p className="text-sm text-purple-800">
                    Super Admins must reset their password via the{" "}
                    <a
                      href="https://app.supabase.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline hover:text-purple-600"
                    >
                      Supabase project dashboard
                    </a>
                    .
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* School Selection Dialog (Smart Discovery) */}
        {showSchoolDialog && (
          <SchoolSelectionDialog
            schools={availableSchools}
            onSelect={handleSchoolSelected}
            isLoading={isLoading}
          />
        )}

      </div>
    </div>
  );
}

/**
 * Forgot Password Dialog Component
 * Handles password reset requests for all non-super-admin roles
 */
function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [forgotPasswordRole, setForgotPasswordRole] =
    useState<AuthRole>("student");
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState("");
  const [forgotPasswordSelectedSchool, setForgotPasswordSelectedSchool] =
    useState("");
  const [forgotPasswordWardAdmissionNumber, setForgotPasswordWardAdmissionNumber] =
    useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [resetRequestMessage, setResetRequestMessage] = useState("");
  const [isRequestingReset, setIsRequestingReset] = useState(false);

  const getIdentifierLabel = (role: AuthRole) => {
    switch (role) {
      case "school_admin":
      case "teacher":
        return "Staff ID";
      case "student":
        return "Admission Number";
      case "parent":
        return "Parent Name";
      default:
        return "Identifier";
    }
  };

  const getIdentifierPlaceholder = (role: AuthRole) => {
    switch (role) {
      case "school_admin":
      case "teacher":
        return "STAFF001";
      case "student":
        return "SBA2024001";
      case "parent":
        return "John Doe";
      default:
        return "";
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingReset(true);
    setForgotPasswordError("");
    setResetRequestMessage("");

    try {
      if (!forgotPasswordSelectedSchool) {
        throw new Error("Please enter your school name or ID.");
      }

      if (forgotPasswordRole === "parent" && !forgotPasswordWardAdmissionNumber) {
        throw new Error(
          "Ward Admission Number is required for parent password reset requests."
        );
      }

      const resolvedSchoolId = await SchoolService.resolveSchoolId(
        forgotPasswordSelectedSchool
      );

      if (!resolvedSchoolId) {
        throw new Error(
          "School not found. Enter the exact registered school name or ID."
        );
      }

      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: forgotPasswordIdentifier,
          role: forgotPasswordRole,
          schoolId: resolvedSchoolId,
          wardAdmissionNumber:
            forgotPasswordRole === "parent"
              ? forgotPasswordWardAdmissionNumber
              : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to submit password reset request."
        );
      }

      setResetRequestMessage(
        data.message ||
          "Your password reset request has been submitted for approval. Please check with your school admin."
      );
    } catch (err) {
      setForgotPasswordError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsRequestingReset(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset Your Password</DialogTitle>
        <DialogDescription>
          Enter your details to request a password reset. Your school admin
          will approve the request before a reset link is sent to your email.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleForgotPasswordRequest} className="space-y-4 py-4">
        {forgotPasswordError && (
          <Alert variant="destructive">
            <AlertDescription>{forgotPasswordError}</AlertDescription>
          </Alert>
        )}

        {resetRequestMessage && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">
              {resetRequestMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Role Selection */}
        <div className="space-y-2">
          <Label htmlFor="forgot-password-role">Role</Label>
          <Select
            value={forgotPasswordRole}
            onValueChange={(value) => {
              setForgotPasswordRole(value as AuthRole);
              setForgotPasswordError("");
              setResetRequestMessage("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="school_admin">School Admin</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* School Selection */}
        <div className="space-y-2">
          <Label htmlFor="forgot-password-school">School Name or ID</Label>
          <Input
            id="forgot-password-school"
            type="text"
            placeholder="Enter your school name or code"
            value={forgotPasswordSelectedSchool}
            onChange={(e) =>
              setForgotPasswordSelectedSchool(e.target.value.trim())
            }
            required
          />
        </div>

        {/* Identifier Field */}
        <div className="space-y-2">
          <Label htmlFor="forgot-password-identifier">
            {getIdentifierLabel(forgotPasswordRole)}
          </Label>
          <Input
            id="forgot-password-identifier"
            type="text"
            placeholder={getIdentifierPlaceholder(forgotPasswordRole)}
            value={forgotPasswordIdentifier}
            onChange={(e) => setForgotPasswordIdentifier(e.target.value)}
            required
          />
        </div>

        {/* Ward Admission Number (Parents Only) */}
        {forgotPasswordRole === "parent" && (
          <div className="space-y-2">
            <Label htmlFor="forgot-password-ward">Ward Admission Number</Label>
            <Input
              id="forgot-password-ward"
              type="text"
              placeholder="SBA2024001"
              value={forgotPasswordWardAdmissionNumber}
              onChange={(e) =>
                setForgotPasswordWardAdmissionNumber(e.target.value)
              }
              required
            />
          </div>
        )}

        {/* Submit Button */}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={isRequestingReset}
          >
            {isRequestingReset ? "Requesting..." : "Request Reset"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
