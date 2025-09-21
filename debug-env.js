// Debug script to check environment variables
console.log("=== Environment Variables Debug ===");
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET"
);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("===================================");

export {};
