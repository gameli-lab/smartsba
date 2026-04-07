// Simple test script to verify the create-admins API
// Run this in the browser console after logging in as a super admin

async function testCreateAdmins() {
  try {
    // Guard: Check if window.supabase exists
    if (typeof window === "undefined" || !window.supabase) {
      console.error(
        "❌ Supabase client is not available. Make sure you're running this in a logged-in browser session with the supabase client loaded."
      );
      return;
    }

    // Get session token
    const {
      data: { session },
    } = await window.supabase.auth.getSession();
    if (!session?.access_token) {
      console.error("No valid session found");
      return;
    }

    // Configuration: Replace with a real school ID from your database
    const TEST_SCHOOL_ID = "REPLACE_WITH_REAL_SCHOOL_ID"; // TODO: Get this from your schools table

    if (TEST_SCHOOL_ID === "REPLACE_WITH_REAL_SCHOOL_ID") {
      console.error(
        "❌ Please update TEST_SCHOOL_ID with a real school ID from your database before running this test."
      );
      console.log(
        "💡 Tip: Run 'SELECT id FROM schools LIMIT 1;' in your Supabase dashboard to get a valid school ID"
      );
      return;
    }

    // Test data
    const testData = {
      schoolId: TEST_SCHOOL_ID,
      admins: [
        {
          name: "Test Headmaster",
          email: "test.headmaster@example.com",
          role: "Headmaster/School Admin",
          staff_id: "HM001",
          phone: "+1234567890",
        },
      ],
    };

    console.log("Testing create-admins API with:", testData);

    const response = await fetch("/api/create-admins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    console.log("API Response Status:", response.status);
    console.log("API Response:", result);

    if (response.ok) {
      console.log("✅ API test successful!");
      if (result.createdAdmins?.length > 0) {
        console.log("Created admins:", result.createdAdmins);
      }
    } else {
      console.log("❌ API test failed:", result.error);
    }
  } catch (error) {
    console.error("Test error:", error);
  }
}

void testCreateAdmins;

// To run the test:
// testCreateAdmins();
