export default async function teardown() {
  console.log('🧹 Cleaning up global test environment...');

  try {
    // Cleanup any global resources
    if (global.__PRISMA__) {
      await global.__PRISMA__.$disconnect();
    }

    // Stop test services if they were started
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
  }
}