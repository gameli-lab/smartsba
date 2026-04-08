"use client";

import { SchoolWithStats } from "@/hooks/useSchools";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  School,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  Clock,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SchoolDetailsDialogProps {
  school: SchoolWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type HeadAdminProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  staff_id: string | null;
};

export function SchoolDetailsDialog({
  school,
  open,
  onOpenChange,
}: SchoolDetailsDialogProps) {
  const [headAdmin, setHeadAdmin] = useState<HeadAdminProfile | null>(null);

  useEffect(() => {
    const loadHeadAdmin = async () => {
      if (!school?.id) {
        setHeadAdmin(null);
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("full_name, email, phone, staff_id")
        .eq("school_id", school.id)
        .eq("role", "school_admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        setHeadAdmin(null);
        return;
      }

      setHeadAdmin({
        full_name: (data as HeadAdminProfile).full_name,
        email: (data as HeadAdminProfile).email,
        phone: (data as HeadAdminProfile).phone,
        staff_id: (data as HeadAdminProfile).staff_id,
      });
    };

    loadHeadAdmin();
  }, [school?.id]);

  if (!school) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{school.name}</DialogTitle>
            <Badge
              variant={school.status === "active" ? "default" : "secondary"}
              className="ml-2"
            >
              {school.status}
            </Badge>
          </div>
          <DialogDescription>
            Complete information about this school
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Headmaster / School Admin */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Headmaster / School Admin
            </h3>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              {headAdmin ? (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">
                        {headAdmin.full_name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Staff ID</p>
                      <p className="text-sm text-muted-foreground">
                        {headAdmin.staff_id || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">
                          {headAdmin.email || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">
                          {headAdmin.phone || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No headmaster / school admin assigned yet.
                </p>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <School className="h-5 w-5" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              {school.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{school.email}</p>
                  </div>
                </div>
              )}
              {school.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{school.phone}</p>
                  </div>
                </div>
              )}
              {school.address && (
                <div className="flex items-start gap-2 md:col-span-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{school.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-4" />

          {/* Statistics */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">Students</p>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {school.student_count}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-900">Teachers</p>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {school.teacher_count}
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-900">Classes</p>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {school.class_count}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t my-4" />

          {/* Dates & Activity */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Dates & Activity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(school.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(school.updated_at)}
                  </p>
                </div>
              </div>

              {school.last_active && (
                <div className="flex items-start gap-2 md:col-span-2">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Active</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(school.last_active)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ID Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">System Information</h3>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">School ID</p>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {school.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
