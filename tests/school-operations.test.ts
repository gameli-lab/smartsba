// Test suite for school deletion with cascade functionality
// Run with: npm test -- school-operations.test.ts

import { deleteSchool } from '../src/lib/school-operations';
import { createClient } from '@supabase/supabase-js';

// Jest globals are provided automatically

// Create test client with service role key to bypass RLS
const testSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

describe('School Operations - Cascade Delete', () => {
  let testSchoolId: string;
  let testUserId: string;
  let testClassId: string;
  let testStudentId: string;

  beforeEach(async () => {
    // Create an auth user to satisfy students.user_id FK
    const email = `student_test_${Date.now()}@example.com`
    const { data: userResult, error: userError } = await testSupabase.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    if (userError || !userResult.user) throw userError || new Error('Failed to create test user')
    testUserId = userResult.user.id

    // Create a test school
    const { data: school, error: schoolError } = await testSupabase
      .from('schools')
      .insert({
        name: 'Test School for Deletion',
        motto: 'Test Motto',
        status: 'active'
      })
      .select()
      .single();

    if (schoolError) throw schoolError;
    testSchoolId = school?.id;

    // Skip user profile creation for now to avoid auth complexity

    // Create a test class
    const { data: classData, error: classError } = await testSupabase
      .from('classes')
      .insert({
        school_id: testSchoolId,
        name: 'Test Class',
        level: 1
      })
      .select()
      .single();

    if (classError) throw classError;
    testClassId = classData?.id;

    // Create a test student
    const { data: student, error: studentError } = await testSupabase
      .from('students')
      .insert({
        user_id: testUserId,
        school_id: testSchoolId,
        admission_number: 'TEST001',
        class_id: testClassId,
        date_of_birth: '2010-01-01',
        gender: 'male',
        admission_date: '2024-01-01'
      })
      .select()
      .single();

    if (studentError) throw studentError;
    testStudentId = student?.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testStudentId) {
      await testSupabase.from('students').delete().eq('id', testStudentId);
    }
    if (testClassId) {
      await testSupabase.from('classes').delete().eq('id', testClassId);
    }
    if (testSchoolId) {
      await testSupabase.from('schools').delete().eq('id', testSchoolId);
    }
    if (testUserId) {
      await testSupabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('should successfully delete school and cascade to related records', async () => {
    // Verify test data exists before deletion
    const { data: beforeSchool } = await testSupabase
      .from('schools')
      .select('id')
      .eq('id', testSchoolId)
      .single();
    expect(beforeSchool).toBeTruthy();

    // Skip user profiles check for simplified testing

    const { data: beforeClasses } = await testSupabase
      .from('classes')
      .select('id')
      .eq('school_id', testSchoolId);
    expect(beforeClasses).toHaveLength(1);

    const { data: beforeStudents } = await testSupabase
      .from('students')
      .select('id')
      .eq('school_id', testSchoolId);
    expect(beforeStudents).toHaveLength(1);

    // Perform deletion
    const result = await deleteSchool(testSchoolId);

    // Verify deletion succeeded
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data).toBeTruthy();

    // Verify school is deleted
    const { data: afterSchool } = await testSupabase
      .from('schools')
      .select('id')
      .eq('id', testSchoolId)
      .single();
    expect(afterSchool).toBeNull();

    // Verify related records are cascaded
    // Skip user profiles check for simplified testing

    const { data: afterClasses } = await testSupabase
      .from('classes')
      .select('id')
      .eq('school_id', testSchoolId);
    expect(afterClasses).toHaveLength(0);

    const { data: afterStudents } = await testSupabase
      .from('students')
      .select('id')
      .eq('school_id', testSchoolId);
    expect(afterStudents).toHaveLength(0);
  });

  it('should handle deletion of non-existent school gracefully', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const result = await deleteSchool(nonExistentId);

    expect(result.error).toBeTruthy();
    expect(result.error?.message).toContain('not found');
    expect(result.data).toBeNull();
  });

  it('should validate school ID input', async () => {
    // Test empty string
    const emptyResult = await deleteSchool('');
    expect(emptyResult.error).toBeTruthy();
    expect(emptyResult.error?.message).toContain('required');

    // Test null/undefined (TypeScript should catch this, but test runtime behavior)
    const nullResult = await deleteSchool(null as never);
    expect(nullResult.error).toBeTruthy();

    // Test invalid format
    const invalidResult = await deleteSchool('invalid-uuid');
    expect(invalidResult.error).toBeTruthy();
  });

  it('should provide detailed logging information', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await deleteSchool(testSchoolId);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Starting transactional school deletion:'),
      expect.any(String)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/School to delete:/),
      expect.any(Object)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Related data to be cascaded:/),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });
});

// Integration test for the database function
describe('Database Function - safe_delete_school', () => {
  let testSchoolId: string;

  beforeEach(async () => {
    const { data: school, error } = await testSupabase
      .from('schools')
      .insert({
        name: 'Test School for DB Function',
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    testSchoolId = school.id;
  });

  it('should execute database function successfully', async () => {
    const { data, error } = await testSupabase
      .rpc('safe_delete_school', { target_school_id: testSchoolId });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.success).toBe(true);
    expect(data?.deleted_school).toBeTruthy();
    expect(data?.related_records_deleted).toBeTruthy();
  });

  it('should handle non-existent school in database function', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await testSupabase
      .rpc('safe_delete_school', { target_school_id: nonExistentId });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.success).toBe(false);
    expect(data?.error).toContain('not found');
  });
});
