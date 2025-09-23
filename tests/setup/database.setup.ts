import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

export async function createTestDatabase(): Promise<string> {
  const testDbId = randomBytes(16).toString('hex');
  const testDbUrl = `${process.env.DATABASE_URL}_test_${testDbId}`;

  try {
    // Set the test database URL in environment
    process.env.DATABASE_URL = testDbUrl;

    // Generate Prisma client for test database
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Push schema to test database
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDbUrl }
    });

    return testDbUrl;
  } catch (error) {
    console.error('Failed to create test database:', error);
    throw error;
  }
}

export async function seedTestDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Clear existing data
    await prisma.token.deleteMany();
    await prisma.tokenMetrics.deleteMany();
    await prisma.safetyAnalysis.deleteMany();

    // Seed test tokens
    const testTokens = [
      {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        symbol: 'TEST1',
        name: 'Test Token 1',
        decimals: 9,
        totalSupply: '1000000000',
        chain: 'solana',
        isActive: true
      },
      {
        address: '5fTwKZP2AK1RtyHPfsiryunHW8GHM7CRnqHcE7JSqyNt',
        symbol: 'TEST2',
        name: 'Test Token 2',
        decimals: 6,
        totalSupply: '500000000',
        chain: 'solana',
        isActive: true
      },
      {
        address: '6gMq3mLu1kB9x7JN4VeK2uH8nQ5tR3wS9cF2dE8aP7nT',
        symbol: 'SCAM',
        name: 'Scam Token',
        decimals: 9,
        totalSupply: '999999999999',
        chain: 'solana',
        isActive: false
      }
    ];

    for (const tokenData of testTokens) {
      const token = await prisma.token.create({
        data: tokenData
      });

      // Create metrics for each token
      await prisma.tokenMetrics.create({
        data: {
          tokenId: token.id,
          price: Math.random() * 10,
          marketCap: Math.random() * 1000000,
          volume24h: Math.random() * 100000,
          priceChange24h: (Math.random() - 0.5) * 20,
          liquidityUsd: Math.random() * 50000,
          holders: Math.floor(Math.random() * 10000),
          timestamp: new Date()
        }
      });

      // Create safety analysis
      await prisma.safetyAnalysis.create({
        data: {
          tokenId: token.id,
          riskScore: Math.random() * 100,
          liquidityRisk: Math.random() * 10,
          ownershipRisk: Math.random() * 10,
          tradingRisk: Math.random() * 10,
          technicalRisk: Math.random() * 10,
          isRugPull: tokenData.symbol === 'SCAM',
          isHoneypot: false,
          timestamp: new Date()
        }
      });
    }

    console.log('Test database seeded successfully');
  } catch (error) {
    console.error('Failed to seed test database:', error);
    throw error;
  }
}

export async function cleanupTestDatabase(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.token.deleteMany();
    await prisma.tokenMetrics.deleteMany();
    await prisma.safetyAnalysis.deleteMany();
    console.log('Test database cleaned up');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    throw error;
  }
}