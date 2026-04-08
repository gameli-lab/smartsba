import { useState, useCallback } from "react";

export interface SchoolFilters {
  status: "all" | "active" | "inactive";
  search: string;
  dateRange: "all" | "last-week" | "last-month" | "last-year";
}

export function useSchoolFilters() {
  const [filters, setFilters] = useState<SchoolFilters>({
    status: "all",
    search: "",
    dateRange: "all",
  });

  const updateFilter = useCallback(<K extends keyof SchoolFilters>(
    key: K,
    value: SchoolFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: "all",
      search: "",
      dateRange: "all",
    });
  }, []);

  return {
    filters,
    updateFilter,
    resetFilters,
    setFilters,
  };
}
