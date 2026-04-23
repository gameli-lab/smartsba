"use client";

import { useState, useRef } from "react";
import {
  Upload,
  User,
  Calendar,
  Building,
  FileImage,
  Stamp,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { uploadSchoolAsset } from "@/lib/storage";
import { getClientCsrfHeaders } from "@/lib/csrf";
import { School } from "@/types";
import Image from "next/image";
import {
  createAdminCreationService,
  type AdminData,
} from "@/services/adminCreationService";
import { sendSchoolCreatedEmail } from "@/services/emailService";

interface CreateSchoolFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school?: School; // For editing existing school
  onSchoolCreated: () => void;
}

interface SchoolSubmissionData {
  name: string;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  stamp_url?: string | null;
  head_signature_url?: string | null;
  status: "active" | "inactive";
  education_levels: EducationLevel[];
  stream_type: StreamType;
  stream_count?: number | null;
}

type EducationLevel = "KG" | "PRIMARY" | "JHS" | "SHS" | "SHTS";
type StreamType = "single" | "double" | "cluster";

const EDUCATION_LEVEL_OPTIONS: Array<{ label: string; value: EducationLevel }> = [
  { label: "KG", value: "KG" },
  { label: "Primary", value: "PRIMARY" },
  { label: "JHS", value: "JHS" },
  { label: "SHS", value: "SHS" },
  { label: "SHTS", value: "SHTS" },
];

interface SchoolFormData {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  current_academic_year: string;
  current_term: "1" | "2" | "3";
  vacation_start: string;
  vacation_end: string;
  term_end: string;
  education_levels: EducationLevel[];
  stream_type: StreamType;
  stream_count: string;
  headmaster_name: string;
  headmaster_staff_id: string;
  headmaster_email: string;
  headmaster_phone: string;
  deputy_name?: string;
  deputy_staff_id?: string;
  deputy_email?: string;
  deputy_phone?: string;
}

interface FileUpload {
  file: File | null;
  preview: string | null;
  uploading: boolean;
}

export default function CreateSchoolForm({
  open,
  onOpenChange,
  school,
  onSchoolCreated,
}: CreateSchoolFormProps) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SchoolFormData>({
    name: school?.name || "",
    motto: school?.motto || "",
    address: school?.address || "",
    phone: school?.phone || "",
    email: school?.email || "",
    website: school?.website || "",
    current_academic_year:
      new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    current_term: "1",
    vacation_start: "",
    vacation_end: "",
    term_end: "",
    education_levels:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((school as any)?.education_levels as EducationLevel[] | undefined) ||
      ["PRIMARY"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_type: ((school as any)?.stream_type as StreamType | undefined) || "single",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream_count: ((school as any)?.stream_count as number | undefined)?.toString() || "",
    headmaster_name: "",
    headmaster_staff_id: "",
    headmaster_email: "",
    headmaster_phone: "",
    deputy_name: "",
    deputy_staff_id: "",
    deputy_email: "",
    deputy_phone: "",
  });

  const [files, setFiles] = useState({
    logo: { file: null, preview: null, uploading: false } as FileUpload,
    stamp: { file: null, preview: null, uploading: false } as FileUpload,
    signature: { file: null, preview: null, uploading: false } as FileUpload,
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: keyof SchoolFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEducationLevel = (level: EducationLevel, checked: boolean) => {
    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          education_levels: Array.from(new Set([...prev.education_levels, level])),
        };
      }

      return {
        ...prev,
        education_levels: prev.education_levels.filter((item) => item !== level),
      };
    });
  };

  // Enhanced file validation with security checks
  const validateImageFile = async (file: File): Promise<boolean> => {
    // Max size check (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File size must be less than 5MB");
      return false;
    }

    // Allowed extensions and MIME types
    const allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert("Only JPG, PNG, GIF, and WebP files are allowed");
      return false;
    }

    if (!allowedMimeTypes.includes(file.type)) {
      alert("Invalid file type");
      return false;
    }

    // Check magic bytes for security
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check magic numbers for common image formats
      const isValidImage =
        // JPEG: FF D8 FF
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        // PNG: 89 50 4E 47
        (bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47) ||
        // GIF: 47 49 46 38
        (bytes[0] === 0x47 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x38) ||
        // WebP: RIFF...WEBP
        (bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50);

      if (!isValidImage) {
        alert("File is not a valid image format");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating file:", error);
      alert("Error validating file");
      return false;
    }
  };

  const handleFileSelect = async (
    type: "logo" | "stamp" | "signature",
    file: File
  ) => {
    // Validate file first
    const isValid = await validateImageFile(file);
    if (!isValid) return;

    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);

    // Test if image loads properly
    const img: HTMLImageElement = document.createElement("img");
    img.onload = () => {
      setFiles((prev) => ({
        ...prev,
        [type]: {
          file,
          preview: objectUrl,
          uploading: false,
        },
      }));
      // Clean up will happen when component unmounts or file changes
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert("Invalid image file");
    };

    img.src = objectUrl;
  };

  const createSchoolAdmins = async (schoolId: string) => {
    const admins: AdminData[] = [];

    // Collect admin information for automatic creation
    if (formData.headmaster_email && formData.headmaster_name) {
      admins.push({
        name: formData.headmaster_name,
        email: formData.headmaster_email,
        role: "Headmaster/School Admin",
        staff_id: formData.headmaster_staff_id,
        phone: formData.headmaster_phone,
      });
    }

    // Store deputy info
    if (formData.deputy_email && formData.deputy_name) {
      admins.push({
        name: formData.deputy_name,
        email: formData.deputy_email,
        role: "Deputy Headmaster",
        staff_id: formData.deputy_staff_id,
        phone: formData.deputy_phone,
      });
    }

    // Return empty array if no admins to create
    if (admins.length === 0) {
      return [];
    }

    // Use admin creation service
    const adminService = createAdminCreationService(supabase);
    return await adminService.createAdmins(admins, schoolId);
  }; // Upload assets to storage
  const uploadAssets = async (uploadFiles: typeof files, schoolId: string) => {
    const logoUrl = uploadFiles.logo.file
      ? await uploadSchoolAsset(uploadFiles.logo.file, schoolId, "logo")
      : school?.logo_url || null;

    const stampUrl = uploadFiles.stamp.file
      ? await uploadSchoolAsset(uploadFiles.stamp.file, schoolId, "stamp")
      : school?.stamp_url || null;

    const signatureUrl = uploadFiles.signature.file
      ? await uploadSchoolAsset(
          uploadFiles.signature.file,
          schoolId,
          "signature"
        )
      : school?.head_signature_url || null;

    return { logoUrl, stampUrl, signatureUrl };
  };

  // Save school data to database
  const saveSchool = async (
    schoolData: SchoolSubmissionData,
    existingSchool?: School
  ): Promise<string> => {
    if (existingSchool) {
      // Update existing school
      // Temporarily use explicit typing until database schema types are regenerated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("schools")
        .update(schoolData)
        .eq("id", existingSchool.id);

      if (error) throw error;
      return existingSchool.id;
    } else {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: getClientCsrfHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify(schoolData),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create school");
      }

      if (!payload?.school?.id) {
        throw new Error("Failed to create school");
      }

      return payload.school.id;
    }
  };

  // Handle admin creation and show appropriate messages
  const handleAdminCreation = async (schoolId: string) => {
    const adminResults = await createSchoolAdmins(schoolId);
    const emailFailures: string[] = [];

    if (adminResults.length > 0) {
      const successfulCreations = adminResults.filter(
        (admin) => !admin.pending_creation
      );
      const pendingCreations = adminResults.filter(
        (admin) => admin.pending_creation
      );

      if (successfulCreations.length > 0) {
        // Send email notifications to successfully created admins
        for (const admin of successfulCreations) {
          try {
            const emailResult = await sendSchoolCreatedEmail({
              schoolName: formData.name,
              adminName: admin.name,
              adminEmail: admin.email,
              adminUserId: admin.userId || '',
              temporaryPassword: admin.password,
              schoolId,
            });
            if (!emailResult.success) {
              throw new Error(emailResult.error || 'Failed to send email')
            }
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
            emailFailures.push(admin.email)
          }
        }

        // Some or all admins created successfully
        const successList = successfulCreations
          .map(
            (admin) =>
              `✅ ${admin.name} (${admin.email}) - Password: ${admin.password}`
          )
          .join("\n");

        const pendingList = pendingCreations
          .map(
            (admin) =>
              `⚠️  ${admin.name} (${admin.email}) - Needs manual creation`
          )
          .join("\n");

        const message =
          `🎉 School created successfully!\n\n` +
          (successfulCreations.length > 0
            ? `Admin Accounts Created:\n${successList}\n\n`
            : "") +
          (pendingCreations.length > 0
            ? `Manual Creation Required:\n${pendingList}\n\n`
            : "") +
          (emailFailures.length === 0
            ? `📧 Email notifications sent to administrators with login credentials.\n`
            : `⚠️  Email failed for: ${emailFailures.join(', ')}\n`) +
          `🔐 They should change their passwords on first login.`;

        alert(message);
      } else {
        // All admins failed automatic creation
        const adminList = adminResults
          .map((admin) => `${admin.name} (${admin.email}) - ${admin.role}`)
          .join("\n");

        alert(
          `🎉 School created successfully!\n\n` +
            `⚠️  Admin accounts need manual creation:\n\n${adminList}\n\n` +
            `Please create these accounts through the Supabase Auth dashboard or invite them via email.`
        );
      }
    } else {
      // No admin info provided
      alert("🎉 School created successfully!");
    }
  };

  // Handle submission errors
  const handleSubmissionError = (error: unknown) => {
    console.error("Error saving school:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Error saving school. Please try again.";
    alert(message);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Generate a temporary school ID for file organization
      const tempSchoolId = school?.id || crypto.randomUUID();

      // Step 1: Upload assets
      const { logoUrl, stampUrl, signatureUrl } = await uploadAssets(
        files,
        tempSchoolId
      );

      // Step 2: Prepare school data
      const schoolData = {
        name: formData.name,
        motto: formData.motto || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        logo_url: logoUrl,
        stamp_url: stampUrl,
        head_signature_url: signatureUrl,
        status: "active" as const,
        education_levels: formData.education_levels,
        stream_type: formData.stream_type,
        stream_count:
          formData.stream_type === "cluster"
            ? Number(formData.stream_count || "0")
            : null,
      };

      // Step 3: Save school
      const schoolId = await saveSchool(schoolData, school);

      // Step 4: Handle admin creation for new schools
      if (!school) {
        await handleAdminCreation(schoolId);
      } else {
        alert("School updated successfully!");
      }

      onSchoolCreated();
      onOpenChange(false);
    } catch (error) {
      handleSubmissionError(error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.name.trim() !== "";
      case 2:
        return true; // Optional branding
      case 3:
        if (!formData.current_academic_year.trim()) return false;
        if (!formData.education_levels.length) return false;
        if (formData.stream_type === "cluster") {
          const count = Number(formData.stream_count || "0");
          return Number.isInteger(count) && count >= 2 && count <= 26;
        }
        return true;
      case 4:
        return (
          formData.headmaster_name.trim() !== "" &&
          formData.headmaster_email.trim() !== ""
        );
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {school ? "Edit School" : "Create New School"}
          </DialogTitle>
          <DialogDescription>
            {school
              ? "Update school information and settings"
              : "Add a new school to the system with all required information"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-16 h-0.5 ${
                      currentStep > step ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-sm text-muted-foreground">
            Step {currentStep} of 4:{" "}
            {currentStep === 1
              ? "Basic Information"
              : currentStep === 2
              ? "Branding & Assets"
              : currentStep === 3
              ? "Academic Settings"
              : "Admin Accounts"}
          </div>

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Basic School Information
                </CardTitle>
                <CardDescription>
                  Enter the basic details about the school
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">School Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="e.g., Accra Academy"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motto">School Motto</Label>
                    <Input
                      id="motto"
                      value={formData.motto}
                      onChange={(e) =>
                        handleInputChange("motto", e.target.value)
                      }
                      placeholder="e.g., Excellence in All Things"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    placeholder="Full school address"
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="+233 XX XXX XXXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="info@school.edu.gh"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) =>
                        handleInputChange("website", e.target.value)
                      }
                      placeholder="https://school.edu.gh"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Branding & Assets */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  School Branding & Assets
                </CardTitle>
                <CardDescription>
                  Upload school logo, official stamp, and headmaster signature
                  (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>School Logo</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {files.logo.preview ? (
                      <div className="space-y-2">
                        <Image
                          src={files.logo.preview}
                          alt="Logo preview"
                          width={96}
                          height={96}
                          className="mx-auto object-contain"
                          unoptimized
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFiles((prev) => ({
                              ...prev,
                              logo: {
                                file: null,
                                preview: null,
                                uploading: false,
                              },
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => logoInputRef.current?.click()}
                          >
                            Upload Logo
                          </Button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect("logo", file);
                      }}
                    />
                  </div>
                </div>

                {/* Stamp & Signature in Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Stamp Upload */}
                  <div className="space-y-2">
                    <Label>Official Stamp/Seal</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {files.stamp.preview ? (
                        <div className="space-y-2">
                          <Image
                            src={files.stamp.preview}
                            alt="Stamp preview"
                            width={64}
                            height={64}
                            className="mx-auto object-contain"
                            unoptimized
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFiles((prev) => ({
                                ...prev,
                                stamp: {
                                  file: null,
                                  preview: null,
                                  uploading: false,
                                },
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Stamp className="mx-auto h-8 w-8 text-gray-400" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => stampInputRef.current?.click()}
                          >
                            Upload Stamp
                          </Button>
                        </div>
                      )}
                      <input
                        ref={stampInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect("stamp", file);
                        }}
                      />
                    </div>
                  </div>

                  {/* Signature Upload */}
                  <div className="space-y-2">
                    <Label>Headmaster Signature</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {files.signature.preview ? (
                        <div className="space-y-2">
                          <Image
                            src={files.signature.preview}
                            alt="Signature preview"
                            width={96}
                            height={64}
                            className="mx-auto object-contain"
                            unoptimized
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFiles((prev) => ({
                                ...prev,
                                signature: {
                                  file: null,
                                  preview: null,
                                  uploading: false,
                                },
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <PenTool className="mx-auto h-8 w-8 text-gray-400" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => signatureInputRef.current?.click()}
                          >
                            Upload Signature
                          </Button>
                        </div>
                      )}
                      <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect("signature", file);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Academic Settings */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Academic Settings
                </CardTitle>
                <CardDescription>
                  Configure levels, stream structure, and current academic dates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Education Levels *</Label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {EDUCATION_LEVEL_OPTIONS.map((levelOption) => {
                      const checked = formData.education_levels.includes(
                        levelOption.value
                      );

                      return (
                        <label
                          key={levelOption.value}
                          className="flex items-center gap-2 border rounded-md px-3 py-2"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleEducationLevel(
                                levelOption.value,
                                value === true
                              )
                            }
                          />
                          <span className="text-sm font-medium">
                            {levelOption.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stream-type">Stream Type *</Label>
                    <Select
                      value={formData.stream_type}
                      onValueChange={(value: StreamType) =>
                        setFormData((prev) => ({
                          ...prev,
                          stream_type: value,
                          stream_count: value === "cluster" ? prev.stream_count : "",
                        }))
                      }
                    >
                      <SelectTrigger id="stream-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Stream</SelectItem>
                        <SelectItem value="double">Double Stream</SelectItem>
                        <SelectItem value="cluster">Cluster Stream</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.stream_type === "cluster" && (
                    <div className="space-y-2">
                      <Label htmlFor="stream-count">Number of Streams *</Label>
                      <Input
                        id="stream-count"
                        type="number"
                        min={2}
                        max={26}
                        value={formData.stream_count}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            stream_count: e.target.value,
                          }))
                        }
                        placeholder="e.g., 4"
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="academic-year">
                      Current Academic Year *
                    </Label>
                    <Input
                      id="academic-year"
                      value={formData.current_academic_year}
                      onChange={(e) =>
                        handleInputChange(
                          "current_academic_year",
                          e.target.value
                        )
                      }
                      placeholder="2024/2025"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current-term">Current Term</Label>
                    <Select
                      value={formData.current_term}
                      onValueChange={(value: "1" | "2" | "3") =>
                        handleInputChange("current_term", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">First Term</SelectItem>
                        <SelectItem value="2">Second Term</SelectItem>
                        <SelectItem value="3">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="vacation-start">Vacation Start Date</Label>
                    <Input
                      id="vacation-start"
                      type="date"
                      value={formData.vacation_start}
                      onChange={(e) =>
                        handleInputChange("vacation_start", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vacation-end">Vacation End Date</Label>
                    <Input
                      id="vacation-end"
                      type="date"
                      value={formData.vacation_end}
                      onChange={(e) =>
                        handleInputChange("vacation_end", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="term-end">Term End Date</Label>
                    <Input
                      id="term-end"
                      type="date"
                      value={formData.term_end}
                      onChange={(e) =>
                        handleInputChange("term_end", e.target.value)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Admin Accounts */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Headmaster */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Headmaster/School Admin *
                  </CardTitle>
                  <CardDescription>
                    Primary administrator account for the school
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="head-name">Full Name *</Label>
                      <Input
                        id="head-name"
                        value={formData.headmaster_name}
                        onChange={(e) =>
                          handleInputChange("headmaster_name", e.target.value)
                        }
                        placeholder="Dr. John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="head-staff-id">Staff ID *</Label>
                      <Input
                        id="head-staff-id"
                        value={formData.headmaster_staff_id}
                        onChange={(e) =>
                          handleInputChange(
                            "headmaster_staff_id",
                            e.target.value
                          )
                        }
                        placeholder="HEAD001"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="head-email">Email Address *</Label>
                      <Input
                        id="head-email"
                        type="email"
                        value={formData.headmaster_email}
                        onChange={(e) =>
                          handleInputChange("headmaster_email", e.target.value)
                        }
                        placeholder="headmaster@school.edu.gh"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="head-phone">Phone Number</Label>
                      <Input
                        id="head-phone"
                        value={formData.headmaster_phone}
                        onChange={(e) =>
                          handleInputChange("headmaster_phone", e.target.value)
                        }
                        placeholder="+233 XX XXX XXXX"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deputy (Optional) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Deputy Head (Optional)
                  </CardTitle>
                  <CardDescription>
                    Secondary administrator account for the school
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="deputy-name">Full Name</Label>
                      <Input
                        id="deputy-name"
                        value={formData.deputy_name}
                        onChange={(e) =>
                          handleInputChange("deputy_name", e.target.value)
                        }
                        placeholder="Mrs. Jane Smith"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deputy-staff-id">Staff ID</Label>
                      <Input
                        id="deputy-staff-id"
                        value={formData.deputy_staff_id}
                        onChange={(e) =>
                          handleInputChange("deputy_staff_id", e.target.value)
                        }
                        placeholder="DEP001"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="deputy-email">Email Address</Label>
                      <Input
                        id="deputy-email"
                        type="email"
                        value={formData.deputy_email}
                        onChange={(e) =>
                          handleInputChange("deputy_email", e.target.value)
                        }
                        placeholder="deputy@school.edu.gh"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deputy-phone">Phone Number</Label>
                      <Input
                        id="deputy-phone"
                        value={formData.deputy_phone}
                        onChange={(e) =>
                          handleInputChange("deputy_phone", e.target.value)
                        }
                        placeholder="+233 XX XXX XXXX"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!school && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">
                        Automatic Account Creation
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Login accounts will be automatically created for the
                        administrators with temporary passwords. You&apos;ll be
                        able to download or email the login credentials after
                        creating the school.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={prevStep}>
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {currentStep < 4 ? (
                <Button onClick={nextStep} disabled={!isStepValid(currentStep)}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !isStepValid(currentStep)}
                >
                  {loading
                    ? "Saving..."
                    : school
                    ? "Update School"
                    : "Create School"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
