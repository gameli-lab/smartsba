import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SchoolFilters } from "@/hooks/useSchoolFilters";

interface SchoolsFiltersProps {
  filters: SchoolFilters;
  onChange: <K extends keyof SchoolFilters>(
    key: K,
    value: SchoolFilters[K]
  ) => void;
}

export function SchoolsFilters({ filters, onChange }: SchoolsFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search schools..."
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
          className="pl-10"
        />
      </div>
      <Select
        value={filters.status}
        onValueChange={(value) =>
          onChange("status", value as SchoolFilters["status"])
        }
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.dateRange}
        onValueChange={(value) =>
          onChange("dateRange", value as SchoolFilters["dateRange"])
        }
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="last-week">Last Week</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="last-year">Last Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
