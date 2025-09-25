// Test setup file
// Loads environment variables for testing

import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Set up any global test configuration here
global.console = {
  ...console,
  // Optionally silence console.log during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
