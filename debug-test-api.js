// Simple test script to verify the create-admins API
// Run this in the browser console after logging in as a super admin

async function testCreateAdmins() {
  try {
    // Get session token
    const {
      data: { session },
    } = await window.supabase.auth.getSession();
    if (!session?.access_token) {
      console.error("No valid session found");
      return;
    }

    // Test data
    const testData = {
      schoolId: "test-school-id",
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

// To run the test:
// testCreateAdmins();
