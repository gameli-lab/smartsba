// Test setup file
// Loads environment variables for testing

import { config } from 'dotenv'

// Load .env first, then override with .env.local if present (common Next.js pattern)
config()
config({ path: '.env.local', override: true })

// Set up any global test configuration here
global.console = {
  ...console,
  // Optionally silence console.log during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
