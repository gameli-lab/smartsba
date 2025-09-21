"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestConnection() {
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Testing...");
  const [envVars, setEnvVars] = useState({
    url: "",
    anonKey: "",
  });

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Check environment variables
        setEnvVars({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? "SET"
            : "NOT SET",
        });

        // Test the connection
        const { error } = await supabase
          .from("user_profiles")
          .select("count")
          .limit(1);

        if (error) {
          setConnectionStatus(`Error: ${error.message}`);
        } else {
          setConnectionStatus("✅ Connection successful!");
        }
      } catch (err) {
        setConnectionStatus(
          `Connection failed: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>

      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Environment Variables:</h2>
          <p>NEXT_PUBLIC_SUPABASE_URL: {envVars.url}</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {envVars.anonKey}</p>
        </div>

        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Connection Status:</h2>
          <p>{connectionStatus}</p>
        </div>

        <div className="mt-6">
          <a
            href="/login"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go to Login Page
          </a>
        </div>
      </div>
    </div>
  );
}
