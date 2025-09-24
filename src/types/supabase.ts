import type {
  School,
  UserProfile,
  AcademicSession,
  Class,
  Subject,
  Teacher,
  TeacherAssignment,
  Student,
  ParentStudentLink,
  StudentAggregate,
  Score,
  ClassTeacherRemark,
  Attendance,
  Announcement,
  UserRole,
  Gender,
  AcademicTerm,
  Grade,
  PromotionStatus
} from './index'

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: School
        Insert: Omit<School, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<School, 'id' | 'created_at' | 'updated_at'>>
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
      }
      academic_sessions: {
        Row: AcademicSession
        Insert: Omit<AcademicSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AcademicSession, 'id' | 'created_at' | 'updated_at'>>
      }
      classes: {
        Row: Class
        Insert: Omit<Class, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Class, 'id' | 'created_at' | 'updated_at'>>
      }
      subjects: {
        Row: Subject
        Insert: Omit<Subject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>
      }
      teachers: {
        Row: Teacher
        Insert: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Teacher, 'id' | 'created_at' | 'updated_at'>>
      }
      teacher_assignments: {
        Row: TeacherAssignment
        Insert: Omit<TeacherAssignment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TeacherAssignment, 'id' | 'created_at' | 'updated_at'>>
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Student, 'id' | 'created_at' | 'updated_at'>>
      }
      parent_student_links: {
        Row: ParentStudentLink
        Insert: Omit<ParentStudentLink, 'id' | 'created_at'>
        Update: Partial<Omit<ParentStudentLink, 'id' | 'created_at'>>
      }
      student_aggregates: {
        Row: StudentAggregate
        Insert: Omit<StudentAggregate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StudentAggregate, 'id' | 'created_at' | 'updated_at'>>
      }
      scores: {
        Row: Score
        Insert: Omit<Score, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Score, 'id' | 'created_at' | 'updated_at'>>
      }
      class_teacher_remarks: {
        Row: ClassTeacherRemark
        Insert: Omit<ClassTeacherRemark, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ClassTeacherRemark, 'id' | 'created_at' | 'updated_at'>>
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Attendance, 'id' | 'created_at' | 'updated_at'>>
      }
      announcements: {
        Row: Announcement
        Insert: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Announcement, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_custom_claims: {
        Args: {
          user_id: string
        }
        Returns: void
      }
      refresh_user_claims: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      update_school_status: {
        Args: {
          school_id: string
          new_status: string
        }
        Returns: void
      }
    }
    Enums: {
      user_role: UserRole
      gender: Gender
      academic_term: AcademicTerm
      grade: Grade
      promotion_status: PromotionStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
