import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { School } from "@/types";

export interface SchoolWithStats extends School {
  student_count: number;
  teacher_count: number;
  class_count: number;
  last_active: string | null;
}

export function useSchools() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Batch fetch all aggregates to avoid N+1 queries
  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      // Get all schools first
      const { data: schoolsData, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!schoolsData) return;

      const schoolIds = schoolsData.map((school: School) => school.id);

      if (schoolIds.length === 0) {
        setSchools([]);
        return;
      }

      // Batch query for user profiles aggregated by school
      const { data: userAggregates, error: userError } = await supabase
        .from("user_profiles")
        .select("school_id, role")
        .in("school_id", schoolIds);

      if (userError) {
        console.error("Error fetching user aggregates:", userError);
      }

      // Batch query for class counts
      const { data: classAggregates, error: classError } = await supabase
        .from("classes")
        .select("school_id")
        .in("school_id", schoolIds);

      if (classError) {
        console.error("Error fetching class aggregates:", classError);
      }

      // Batch query for last activity
      const { data: activityAggregates, error: activityError } = await supabase
        .from("user_profiles")
        .select("school_id, updated_at")
        .in("school_id", schoolIds)
        .order("updated_at", { ascending: false });

      if (activityError) {
        console.error("Error fetching activity aggregates:", activityError);
      }

      // Process aggregates into maps for efficient lookup
      const userCountsBySchool = new Map<string, { students: number; teachers: number }>();
      const classCountsBySchool = new Map<string, number>();
      const lastActivityBySchool = new Map<string, string>();

      // Process user counts
      userAggregates?.forEach((profile: { school_id: string; role: string }) => {
        const current = userCountsBySchool.get(profile.school_id) || { students: 0, teachers: 0 };
        if (profile.role === "student") current.students++;
        if (profile.role === "teacher") current.teachers++;
        userCountsBySchool.set(profile.school_id, current);
      });

      // Process class counts
      classAggregates?.forEach((cls: { school_id: string }) => {
        const current = classCountsBySchool.get(cls.school_id) || 0;
        classCountsBySchool.set(cls.school_id, current + 1);
      });

      // Process last activity (already sorted, so first occurrence is most recent)
      const seenSchools = new Set<string>();
      activityAggregates?.forEach((activity: { school_id: string; updated_at: string }) => {
        if (!seenSchools.has(activity.school_id)) {
          lastActivityBySchool.set(activity.school_id, activity.updated_at);
          seenSchools.add(activity.school_id);
        }
      });

      // Combine everything
      const schoolsWithStats: SchoolWithStats[] = schoolsData.map((school: School) => {
        const userCounts = userCountsBySchool.get(school.id) || { students: 0, teachers: 0 };
        const classCount = classCountsBySchool.get(school.id) || 0;
        const lastActive = lastActivityBySchool.get(school.id) || null;

        return {
          ...school,
          student_count: userCounts.students,
          teacher_count: userCounts.teachers,
          class_count: classCount,
          last_active: lastActive,
        };
      });

      setSchools(schoolsWithStats);
    } catch (error) {
      console.error("Error fetching schools:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSchools = useCallback(() => {
    fetchSchools();
  }, [fetchSchools]);

  const updateSchoolInList = useCallback((schoolId: string, updates: Partial<SchoolWithStats>) => {
    setSchools((prev) =>
      prev.map((school) =>
        school.id === schoolId ? { ...school, ...updates } : school
      )
    );
  }, []);

  const removeSchoolFromList = useCallback((schoolId: string) => {
    setSchools((prev) => prev.filter((school) => school.id !== schoolId));
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  return {
    schools,
    loading,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    refreshSchools,
    updateSchoolInList,
    removeSchoolFromList,
  };
}
