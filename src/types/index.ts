// User Roles
export type UserRole = 
  | 'super_admin' 
  | 'school_admin' 
  | 'teacher' 
  | 'student' 
  | 'parent'

// Gender types
export type Gender = 'male' | 'female'

// Academic terms
export type AcademicTerm = 1 | 2 | 3

// Grade types
export type Grade = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

// Promotion status
export type PromotionStatus = 'promoted' | 'repeated' | 'withdrawn' | 'pending'

// School Entity
export interface School {
  id: string
  name: string
  motto?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  logo_url?: string
  stamp_url?: string
  head_signature_url?: string
  education_levels?: Array<'KG' | 'PRIMARY' | 'JHS' | 'SHS' | 'SHTS'>
  stream_type?: 'single' | 'double' | 'cluster'
  stream_count?: number | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

// User Profile Entity
export interface UserProfile {
  id: string
  user_id: string
  school_id: string
  role: UserRole
  email: string
  full_name: string
  status?: 'active' | 'disabled'
  staff_id?: string
  admission_number?: string
  phone?: string
  address?: string
  photo_url?: string
  gender?: Gender
  date_of_birth?: string
  created_at: string
  updated_at: string
}

// Academic Session Entity
export interface AcademicSession {
  id: string
  school_id: string
  academic_year: string
  term: AcademicTerm
  start_date: string
  end_date: string
  vacation_date?: string
  reopening_date?: string
  is_current: boolean
  created_at: string
  updated_at: string
}

// Class Entity
export interface Class {
  id: string
  school_id: string
  name: string
  stream?: string
  level: number
  description?: string
  class_teacher_id?: string
  status?: 'active' | 'archived'
  created_at: string
  updated_at: string
}

// Subject Entity
export interface Subject {
  id: string
  school_id: string
  level_group: 'NURSERY' | 'KG' | 'PRIMARY' | 'JHS'
  name: string
  code?: string
  description?: string
  is_core: boolean
  is_active?: boolean
  created_at: string
  updated_at: string
}

// Teacher Entity
export interface Teacher {
  id: string
  school_id: string
  user_id: string
  staff_id: string
  specialization?: string
  qualification?: string
  hire_date?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Teacher Assignment Entity
export interface TeacherAssignment {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string
  is_class_teacher: boolean
  academic_year: string
  created_at: string
  updated_at: string
}

// Student Entity
export interface Student {
  id: string
  school_id: string
  user_id: string
  admission_number: string
  roll_number?: string
  class_id: string
  date_of_birth: string
  gender: Gender
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
  address?: string
  admission_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Parent-Student Link Entity
export interface ParentStudentLink {
  id: string
  parent_id: string
  student_id: string
  relationship: string
  is_primary: boolean
  created_at: string
}

// Student Aggregate Entity
export interface StudentAggregate {
  id: string
  student_id: string
  session_id: string
  class_id: string
  aggregate_score: number
  total_subjects: number
  core_subjects_count: number
  elective_subjects_count: number
  class_position?: number
  overall_position?: number
  created_at: string
  updated_at: string
}

// Score Entity
export interface Score {
  id: string
  student_id: string
  subject_id: string
  session_id: string
  ca_score?: number
  exam_score?: number
  total_score?: number
  grade?: Grade
  position?: number
  subject_remark?: string
  entered_by: string
  created_at: string
  updated_at: string
}

// Class Teacher Remark Entity
export interface ClassTeacherRemark {
  id: string
  student_id: string
  session_id: string
  remark: string
  promotion_status?: PromotionStatus
  next_class_id?: string
  entered_by: string
  created_at: string
  updated_at: string
}

// Attendance Entity
export interface Attendance {
  id: string
  student_id: string
  session_id: string
  present_days: number
  total_days: number
  percentage: number
  entered_by: string
  created_at: string
  updated_at: string
}

// Announcement Entity
export interface Announcement {
  id: string
  school_id: string
  title: string
  content: string
  target_audience: UserRole[]
  class_ids?: string[]
  is_urgent: boolean
  published_at?: string
  expires_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

// Report Card Data (for PDF generation)
export interface ReportCardData {
  school: School
  session: AcademicSession
  student: Student & { user_profile: UserProfile }
  class: Class
  scores: (Score & { 
    subject: Subject
  })[]
  attendance: Attendance
  class_teacher_remark?: ClassTeacherRemark
  totals: {
    total_ca: number
    total_exam: number
    grand_total: number
    average: number
    aggregate: number
    position: number
    out_of: number
  }
}

// Class Report Data
export interface ClassReportData {
  school: School
  session: AcademicSession
  class: Class
  students: (Student & {
    user_profile: UserProfile
    scores: (Score & { subject: Subject })[]
    totals: {
      total_score: number
      average: number
      position: number
      aggregate: number
    }
  })[]
  subjects: Subject[]
}

// Dashboard Statistics
export interface DashboardStats {
  students_count: number
  teachers_count: number
  classes_count: number
  subjects_count: number
  recent_announcements: Announcement[]
}

// Form Types
export interface LoginForm {
  identifier: string
  password: string
  role: UserRole
  wardAdmissionNumber?: string
}

export interface StudentForm {
  full_name: string
  admission_number: string
  roll_number?: string
  class_id: string
  date_of_birth: string
  gender: Gender
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
  address?: string
  admission_date: string
}

export interface ScoreForm {
  student_id: string
  subject_id: string
  session_id: string
  ca_score?: number
  exam_score?: number
  subject_remark?: string
}

export interface TeacherForm {
  full_name: string
  email: string
  staff_id: string
  phone?: string
  specialization?: string
  qualification?: string
  hire_date?: string
  password: string
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
