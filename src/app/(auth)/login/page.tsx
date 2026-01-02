"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { AuthService } from "@/lib/auth";
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
import Link from "next/link";

export default function LoginPage() {
  const [role, setRole] = useState<UserRole>("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [wardAdmissionNumber, setWardAdmissionNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // New state for Forgot Password functionality
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState("");
  const [forgotPasswordRole, setForgotPasswordRole] =
    useState<UserRole>("student");
  const [forgotPasswordSchoolSearch, setForgotPasswordSchoolSearch] =
    useState("");
  const [forgotPasswordSelectedSchool, setForgotPasswordSelectedSchool] =
    useState("");
  const [
    forgotPasswordWardAdmissionNumber,
    setForgotPasswordWardAdmissionNumber,
  ] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [resetRequestMessage, setResetRequestMessage] = useState("");
  const [forgotPasswordSchools, setForgotPasswordSchools] = useState<School[]>(
    [],
  ); // New state for forgot password schools search
  const [isLoadingForgotPasswordSchools, setIsLoadingForgotPasswordSchools] =
    useState(false); // New state for forgot password schools search loading

  // Load schools when search term changes
  useEffect(() => {
    const loadSchools = async () => {
      if (schoolSearch.length >= 2) {
        setIsLoadingSchools(true);
        try {
          const searchResults = await SchoolService.searchSchools(schoolSearch);
          setSchools(searchResults);
        } catch (error) {
          console.error("Failed to load schools:", error);
        } finally {
          setIsLoadingSchools(false);
        }
      } else {
        setSchools([]);
      }
    };

    const timeoutId = setTimeout(loadSchools, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [schoolSearch]);

  // Load schools for forgot password when search term changes
  useEffect(() => {
    const loadForgotPasswordSchools = async () => {
      if (forgotPasswordSchoolSearch.length >= 2) {
        setIsLoadingForgotPasswordSchools(true);
        try {
          const searchResults = await SchoolService.searchSchools(
            forgotPasswordSchoolSearch,
          );
          setForgotPasswordSchools(searchResults);
        } catch (error) {
          console.error("Failed to load forgot password schools:", error);
        } finally {
          setIsLoadingForgotPasswordSchools(false);
        }
      } else {
        setForgotPasswordSchools([]);
      }
    };

    const timeoutId = setTimeout(loadForgotPasswordSchools, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [forgotPasswordSchoolSearch]);

  // Reset school selection for forgot password when role changes
  useEffect(() => {
    setForgotPasswordSelectedSchool("");
    setForgotPasswordSchoolSearch("");
    setForgotPasswordSchools([]);
  }, [forgotPasswordRole]);

  const requiresSchoolSelection = (selectedRole: UserRole) => {
    return selectedRole !== "super_admin";
  };

  const getIdentifierLabel = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case "super_admin":
        return "Email Address";
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

  const getIdentifierPlaceholder = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case "super_admin":
        return "admin@smartsba.com";
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
      if (forgotPasswordRole === "super_admin") {
        setForgotPasswordError(
          "Super Admins must reset their password via the Supabase project dashboard.",
        );
        setIsRequestingReset(false);
        return;
      }

      if (
        requiresSchoolSelection(forgotPasswordRole) &&
        !forgotPasswordSelectedSchool
      ) {
        throw new Error("Please select your school.");
      }

      if (
        forgotPasswordRole === "parent" &&
        !forgotPasswordWardAdmissionNumber
      ) {
        throw new Error(
          "Ward Admission Number is required for parent password reset requests.",
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
          schoolId: requiresSchoolSelection(forgotPasswordRole)
            ? forgotPasswordSelectedSchool
            : undefined,
          wardAdmissionNumber:
            forgotPasswordRole === "parent"
              ? forgotPasswordWardAdmissionNumber
              : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to submit password reset request.",
        );
      }

      setResetRequestMessage(
        data.message ||
          "Your password reset request has been submitted for approval. Please check with your school admin.",
      );
    } catch (err) {
      setForgotPasswordError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate school selection for non-super admin roles
      if (requiresSchoolSelection(role) && !selectedSchool) {
        throw new Error("Please select a school");
      }

      const result = await AuthService.login({
        identifier,
        password,
        role,
        schoolId: requiresSchoolSelection(role) ? selectedSchool : undefined,
        wardAdmissionNumber:
          role === "parent" ? wardAdmissionNumber : undefined,
      });

      if (!result || !result.profile) {
        throw new Error("Login failed - no profile returned");
      }

      // Redirect based on role
      switch (result.profile.role) {
        case "super_admin":
          router.push("/dashboard/super-admin");
          break;
        case "school_admin":
          router.push("/dashboard/school-admin");
          break;
        case "teacher":
          router.push("/dashboard/teacher");
          break;
        case "student":
          router.push("/dashboard/student");
          break;
        case "parent":
          router.push("/dashboard/parent");
          break;
        default:
          router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Smart SBA System
          </h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Select your role and enter your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="school_admin">School Admin</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* School Selection - Only for non-super admin roles */}
              {requiresSchoolSelection(role) && (
                <div className="space-y-2">
                  <Label htmlFor="school">School</Label>
                  <div className="space-y-2">
                    <Input
                      id="school-search"
                      type="text"
                      placeholder="Type to search schools..."
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                    />
                    {schools.length > 0 && (
                      <Select
                        value={selectedSchool}
                        onValueChange={setSelectedSchool}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your school" />
                        </SelectTrigger>
                        <SelectContent>
                          {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {school.name}
                                </span>
                                {school.address && (
                                  <span className="text-xs text-gray-500">
                                    {school.address}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isLoadingSchools && (
                      <div className="text-sm text-gray-500">
                        Searching schools...
                      </div>
                    )}
                    {schoolSearch.length >= 2 &&
                      schools.length === 0 &&
                      !isLoadingSchools && (
                        <div className="text-sm text-gray-500">
                          No schools found
                        </div>
                      )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier">{getIdentifierLabel(role)}</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder={getIdentifierPlaceholder(role)}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              {role === "parent" && (
                <div className="space-y-2">
                  <Label htmlFor="wardAdmissionNumber">
                    Ward Admission Number
                  </Label>
                  <Input
                    id="wardAdmissionNumber"
                    type="text"
                    placeholder="SBA2024001"
                    value={wardAdmissionNumber}
                    onChange={(e) => setWardAdmissionNumber(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Dialog
                open={showForgotPasswordModal}
                onOpenChange={setShowForgotPasswordModal}
              >
                <DialogTrigger asChild>
                  <Button variant="link" className="px-0">
                    Forgot Password?
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Reset Your Password</DialogTitle>
                    <DialogDescription>
                      {forgotPasswordRole === "super_admin"
                        ? "Super Admins must reset their password via the Supabase project dashboard."
                        : "Enter your details to request a password reset. Your school admin will approve the request before a reset link is sent to your email."}
                    </DialogDescription>
                  </DialogHeader>
                  {forgotPasswordRole !== "super_admin" && (
                    <form
                      onSubmit={handleForgotPasswordRequest}
                      className="space-y-4 py-4"
                    >
                      {forgotPasswordError && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            {forgotPasswordError}
                          </AlertDescription>
                        </Alert>
                      )}
                      {resetRequestMessage && (
                        <Alert
                          variant="default"
                          className="bg-green-500 text-white"
                        >
                          <AlertDescription>
                            {resetRequestMessage}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="forgot-password-role">Role</Label>
                        <Select
                          value={forgotPasswordRole}
                          onValueChange={(value) => {
                            setForgotPasswordRole(value as UserRole);
                            setForgotPasswordError(""); // Clear error when role changes
                            setResetRequestMessage(""); // Clear message
                          }}
                        >
                          <SelectTrigger id="forgot-password-role">
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="school_admin">
                              School Admin
                            </SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="super_admin">
                              Super Admin
                            </SelectItem>{" "}
                            {/* Keep this for the warning message */}
                          </SelectContent>
                        </Select>
                      </div>

                      {requiresSchoolSelection(forgotPasswordRole) && (
                        <div className="space-y-2">
                          <Label htmlFor="forgot-password-school">School</Label>
                          <div className="space-y-2">
                            <Input
                              id="forgot-password-school-search"
                              type="text"
                              placeholder="Type to search schools..."
                              value={forgotPasswordSchoolSearch}
                              onChange={(e) =>
                                setForgotPasswordSchoolSearch(e.target.value)
                              }
                            />
                            {forgotPasswordSchools.length > 0 && (
                              <Select
                                value={forgotPasswordSelectedSchool}
                                onValueChange={setForgotPasswordSelectedSchool}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your school" />
                                </SelectTrigger>
                                <SelectContent>
                                  {forgotPasswordSchools.map((school) => (
                                    <SelectItem
                                      key={school.id}
                                      value={school.id}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {school.name}
                                        </span>
                                        {school.address && (
                                          <span className="text-xs text-gray-500">
                                            {school.address}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {isLoadingForgotPasswordSchools && (
                              <div className="text-sm text-gray-500">
                                Searching schools...
                              </div>
                            )}
                            {forgotPasswordSchoolSearch.length >= 2 &&
                              forgotPasswordSchools.length === 0 &&
                              !isLoadingForgotPasswordSchools && (
                                <div className="text-sm text-gray-500">
                                  No schools found
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="forgot-password-identifier">
                          {getIdentifierLabel(forgotPasswordRole)}
                        </Label>
                        <Input
                          id="forgot-password-identifier"
                          type="text"
                          placeholder={getIdentifierPlaceholder(
                            forgotPasswordRole,
                          )}
                          value={forgotPasswordIdentifier}
                          onChange={(e) =>
                            setForgotPasswordIdentifier(e.target.value)
                          }
                          required
                        />
                      </div>

                      {forgotPasswordRole === "parent" && (
                        <div className="space-y-2">
                          <Label htmlFor="forgot-password-ward-admission-number">
                            Ward Admission Number
                          </Label>
                          <Input
                            id="forgot-password-ward-admission-number"
                            type="text"
                            placeholder="SBA2024001"
                            value={forgotPasswordWardAdmissionNumber}
                            onChange={(e) =>
                              setForgotPasswordWardAdmissionNumber(
                                e.target.value,
                              )
                            }
                            required
                          />
                        </div>
                      )}
                      <DialogFooter>
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={isRequestingReset}
                        >
                          {isRequestingReset
                            ? "Requesting..."
                            : "Request Reset"}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                  {forgotPasswordRole === "super_admin" && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-700">
                        Super Admins should manage their password resets
                        directly through the{" "}
                        <a
                          href="https://app.supabase.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Supabase project dashboard
                        </a>
                        .
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setShowForgotPasswordModal(false)}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-600">
          <p>Multi-School System - Select your school before logging in</p>
        </div>
      </div>
    </div>
  );
}
