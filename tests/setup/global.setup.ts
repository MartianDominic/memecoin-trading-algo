import { config } from 'dotenv';
import { execSync } from 'child_process';

export default async function setup() {
  console.log('🚀 Setting up global test environment...');

  // Load test environment
  config({ path: '.env.test' });

  // Ensure test environment variables
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/memecoin_test';
  }

  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379/1';
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  // Mock external API endpoints
  process.env.DEXSCREENER_BASE_URL = 'http://localhost:3001/mock/dexscreener';
  process.env.RUGCHECK_BASE_URL = 'http://localhost:3001/mock/rugcheck';
  process.env.JUPITER_BASE_URL = 'http://localhost:3001/mock/jupiter';
  process.env.SOLSCAN_BASE_URL = 'http://localhost:3001/mock/solscan';

  try {
    // Start test services if needed
    console.log('✅ Global test setup completed');
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    process.exit(1);
  }
}