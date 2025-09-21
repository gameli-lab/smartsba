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

  // Reset school selection when role changes
  useEffect(() => {
    setSelectedSchool("");
    setSchoolSearch("");
    setSchools([]);
  }, [role]);

  const requiresSchoolSelection = () => {
    return role !== "super_admin";
  };

  const getIdentifierLabel = () => {
    switch (role) {
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

  const getIdentifierPlaceholder = () => {
    switch (role) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate school selection for non-super admin roles
      if (requiresSchoolSelection() && !selectedSchool) {
        throw new Error("Please select a school");
      }

      const result = await AuthService.login({
        identifier,
        password,
        role,
        schoolId: requiresSchoolSelection() ? selectedSchool : undefined,
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
              {requiresSchoolSelection() && (
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
                <Label htmlFor="identifier">{getIdentifierLabel()}</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder={getIdentifierPlaceholder()}
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
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-600">
          <p>Multi-School System - Select your school before logging in</p>
          <div className="mt-2">
            <p>Demo Credentials:</p>
            <p>Super Admin: admin@demo.com / password</p>
            <p>School Admin: ADMIN001 / password</p>
            <p>Teacher: TEACH001 / password</p>
            <p>Student: STU2024001 / password</p>
          </div>
        </div>
      </div>
    </div>
  );
}
