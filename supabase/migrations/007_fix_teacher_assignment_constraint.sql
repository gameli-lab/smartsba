-- Fix teacher_assignments constraint to allow a teacher to teach the same subject
-- across multiple classes, while preventing multiple teachers from teaching the same
-- subject in the same class.
-- Old constraint: UNIQUE (teacher_id, subject_id, academic_year)
--   This prevented a teacher from teaching e.g. Math in two different classes.
-- New constraint: UNIQUE (class_id, subject_id, academic_year)
--   This prevents two teachers from teaching the same subject in the same class,
--   but allows a teacher to teach across multiple classes.

ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS unique_teacher_subject_assignment;
ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS unique_class_teacher_per_class;
ALTER TABLE teacher_assignments ADD CONSTRAINT unique_class_subject_assignment UNIQUE (class_id, subject_id, academic_year);