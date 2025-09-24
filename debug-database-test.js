// Quick database structure test - run this in browser console to debug
// This helps diagnose what's causing the user deactivation error

async function testDatabaseStructure() {
  console.log('=== DATABASE STRUCTURE TEST ===');
  
  try {
    // Test 1: Check if user_profiles table exists and what columns it has
    console.log('1. Testing user_profiles table structure...');
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.error('❌ user_profiles error:', usersError);
    } else {
      console.log('✅ user_profiles sample:', users);
      if (users && users.length > 0) {
        console.log('📋 Available columns:', Object.keys(users[0]));
      }
    }
    
    // Test 2: Check schools table
    console.log('2. Testing schools table structure...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('*')
      .limit(1);
    
    if (schoolsError) {
      console.error('❌ schools error:', schoolsError);
    } else {
      console.log('✅ schools sample:', schools);
      if (schools && schools.length > 0) {
        console.log('📋 Available columns:', Object.keys(schools[0]));
      }
    }
    
    // Test 3: Try to find users for a specific school
    if (schools && schools.length > 0) {
      const testSchoolId = schools[0].id;
      console.log('3. Testing user lookup for school:', testSchoolId);
      
      const { data: schoolUsers, error: lookupError } = await supabase
        .from('user_profiles')
        .select('user_id, email, role, school_id')
        .eq('school_id', testSchoolId);
      
      if (lookupError) {
        console.error('❌ user lookup error:', lookupError);
      } else {
        console.log('✅ users for school:', schoolUsers);
      }
    }
    
    console.log('=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('💥 Test exception:', error);
  }
}

// To run the test, copy this into browser console after logging in:
// testDatabaseStructure();
