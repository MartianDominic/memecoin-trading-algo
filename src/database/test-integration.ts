/**
 * test-integration.ts - Database schema and service integration test
 * Simple test to validate database connectivity and basic operations
 */

import DatabaseService, { DatabaseConfig, DbToken, DbTokenAnalysis } from './DatabaseService';

// Test configuration (use environment variables in production)
const testConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'memecoin_trading',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production',
  max: 5 // Limit connections for testing
};

async function testDatabaseIntegration(): Promise<void> {
  const db = new DatabaseService(testConfig);

  try {
    console.log('🔌 Testing database connection...');
    await db.connect();

    console.log('❤️  Testing health check...');
    const health = await db.healthCheck();
    console.log(`Health: ${health.healthy ? '✅' : '❌'} (${health.latency}ms)`);

    if (!health.healthy) {
      throw new Error(`Database unhealthy: ${health.error}`);
    }

    console.log('📊 Testing token statistics...');
    const stats = await db.getTokenStatistics();
    console.log('Token Statistics:', stats);

    console.log('🎯 Testing filter templates...');
    const templates = await db.getFilterTemplates();
    console.log(`Found ${templates.length} filter templates`);

    // Test creating a sample token
    console.log('🪙 Testing token creation...');
    const sampleToken: Partial<DbToken> = {
      address: 'TEST123456789',
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 9,
      market_cap: '1000000',
      price_usd: '0.01',
      volume_24h: '50000',
      is_verified: false,
      is_scam: false,
      is_honeypot: false
    };

    const createdToken = await db.createToken(sampleToken);
    console.log('✅ Token created:', createdToken.address);

    // Test retrieving the token
    console.log('🔍 Testing token retrieval...');
    const retrievedToken = await db.getToken(createdToken.address);
    console.log('✅ Token retrieved:', retrievedToken?.symbol);

    // Test creating sample analysis
    console.log('📈 Testing analysis creation...');
    const sampleAnalysis: Partial<DbTokenAnalysis> = {
      token_address: createdToken.address,
      dex_data: {
        pairs: [{ dexId: 'test', pairAddress: 'pair123', priceUsd: '0.01', volume24h: 50000, liquidity: 25000, priceChange24h: 5.2 }],
        marketCap: 1000000,
        holders: 150,
        lastUpdated: new Date().toISOString()
      },
      dex_score: 75,
      rug_data: {
        mintAuthority: false,
        freezeAuthority: false,
        liquidityLocked: true,
        holderConcentration: 15.5,
        topHolders: [{ address: 'holder1', percentage: 8.2 }],
        risks: [],
        warnings: ['New token'],
        safetyChecks: { hasWebsite: true, hasLiquidity: true, hasVolume: true }
      },
      rug_score: 80,
      rug_risk_level: 'low',
      overall_score: 77,
      risk_score: 20,
      opportunity_score: 85,
      analysis_complete: true,
      has_errors: false
    };

    const createdAnalysis = await db.createTokenAnalysis(sampleAnalysis);
    console.log('✅ Analysis created:', createdAnalysis.id);

    // Test getting latest analysis
    console.log('📊 Testing latest analysis retrieval...');
    const latestAnalysis = await db.getLatestTokenAnalysis(createdToken.address);
    console.log('✅ Latest analysis retrieved:', latestAnalysis?.overall_score);

    // Test creating an alert
    console.log('🚨 Testing alert creation...');
    const alertId = await db.createAlert({
      token_address: createdToken.address,
      alert_type: 'test_alert',
      severity: 'medium',
      title: 'Test Alert',
      message: 'This is a test alert for integration testing',
      alert_data: {
        metadata: {
          sourceService: 'integration-test',
          confidence: 100
        }
      }
    });
    console.log('✅ Alert created:', alertId);

    // Test cleanup (remove test data)
    console.log('🧹 Cleaning up test data...');
    await db.pool.query('DELETE FROM alerts WHERE token_address = $1', [createdToken.address]);
    await db.pool.query('DELETE FROM token_analysis WHERE token_address = $1', [createdToken.address]);
    await db.pool.query('DELETE FROM tokens WHERE address = $1', [createdToken.address]);
    console.log('✅ Test data cleaned up');

    console.log('🎉 All database integration tests passed!');

  } catch (error) {
    console.error('❌ Database integration test failed:', error);
    throw error;
  } finally {
    await db.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDatabaseIntegration()
    .then(() => {
      console.log('✅ Integration test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Integration test failed:', error);
      process.exit(1);
    });
}

export { testDatabaseIntegration, testConfig };