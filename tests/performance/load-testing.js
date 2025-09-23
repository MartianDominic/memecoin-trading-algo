const { performance } = require('perf_hooks');
const autocannon = require('autocannon');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

/**
 * Performance testing suite for memecoin trading algorithm
 */
class PerformanceTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      duration: config.duration || 30, // seconds
      connections: config.connections || 10,
      pipelining: config.pipelining || 1,
      maxLatency: config.maxLatency || 1000, // ms
      minThroughput: config.minThroughput || 100, // req/sec
      ...config
    };

    this.results = {};
  }

  /**
   * Run comprehensive load testing suite
   */
  async runLoadTests() {
    console.log('🚀 Starting performance load testing...');

    const tests = [
      { name: 'Token List API', endpoint: '/api/tokens', method: 'GET' },
      { name: 'Token Filter API', endpoint: '/api/tokens/filter', method: 'POST' },
      { name: 'Token Details API', endpoint: '/api/tokens/test-token-1', method: 'GET' },
      { name: 'Price History API', endpoint: '/api/tokens/test-token-1/history', method: 'GET' },
      { name: 'Mixed Workload', endpoint: null, method: 'MIXED' }
    ];

    for (const test of tests) {
      console.log(`\n📊 Running ${test.name} load test...`);

      try {
        if (test.method === 'MIXED') {
          this.results[test.name] = await this.runMixedWorkloadTest();
        } else {
          this.results[test.name] = await this.runSingleEndpointTest(test);
        }

        console.log(`✅ ${test.name} completed`);
        this.printTestSummary(test.name, this.results[test.name]);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        this.results[test.name] = { error: error.message };
      }
    }

    this.generatePerformanceReport();
    return this.results;
  }

  /**
   * Run load test for a single endpoint
   */
  async runSingleEndpointTest(test) {
    const options = {
      url: `${this.config.baseUrl}${test.endpoint}`,
      connections: this.config.connections,
      pipelining: this.config.pipelining,
      duration: this.config.duration,
      method: test.method,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add request body for POST requests
    if (test.method === 'POST') {
      options.body = JSON.stringify({
        conditions: [
          {
            field: 'volume24h',
            operator: 'gte',
            value: 10000
          }
        ],
        logic: 'AND'
      });
    }

    return new Promise((resolve, reject) => {
      const instance = autocannon(options, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.processAutocannonResult(result));
        }
      });

      // Track progress
      autocannon.track(instance, {
        renderProgressBar: true,
        renderResultsTable: false
      });
    });
  }

  /**
   * Run mixed workload test simulating real user behavior
   */
  async runMixedWorkloadTest() {
    const scenarios = [
      { weight: 40, endpoint: '/api/tokens', method: 'GET' },
      { weight: 25, endpoint: '/api/tokens/filter', method: 'POST' },
      { weight: 20, endpoint: '/api/tokens/test-token-1', method: 'GET' },
      { weight: 15, endpoint: '/api/tokens/test-token-1/history', method: 'GET' }
    ];

    return new Promise((resolve, reject) => {
      const requests = scenarios.map(scenario => ({
        ...scenario,
        setupRequest: (req, context) => {
          if (scenario.method === 'POST') {
            req.body = JSON.stringify({
              conditions: [{
                field: 'volume24h',
                operator: 'gte',
                value: Math.floor(Math.random() * 100000)
              }],
              logic: 'AND'
            });
          }
          return req;
        }
      }));

      const instance = autocannon({
        url: this.config.baseUrl,
        connections: this.config.connections,
        pipelining: this.config.pipelining,
        duration: this.config.duration,
        requests
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.processAutocannonResult(result));
        }
      });

      autocannon.track(instance, { renderProgressBar: true });
    });
  }

  /**
   * Process autocannon results into standardized format
   */
  processAutocannonResult(result) {
    return {
      throughput: {
        average: result.throughput.average,
        stddev: result.throughput.stddev,
        min: result.throughput.min,
        max: result.throughput.max
      },
      latency: {
        average: result.latency.average,
        stddev: result.latency.stddev,
        min: result.latency.min,
        max: result.latency.max,
        p50: result.latency.p50,
        p90: result.latency.p90,
        p95: result.latency.p95,
        p99: result.latency.p99
      },
      requests: {
        total: result.requests.total,
        average: result.requests.average,
        stddev: result.requests.stddev,
        min: result.requests.min,
        max: result.requests.max
      },
      errors: result.errors,
      timeouts: result.timeouts,
      duration: result.duration,
      start: result.start,
      finish: result.finish,
      connections: result.connections,
      pipelining: result.pipelining,
      non2xx: result.non2xx,
      statusCodeStats: result.statusCodeStats
    };
  }

  /**
   * Print test summary
   */
  printTestSummary(testName, result) {
    if (result.error) {
      console.log(`❌ ${testName}: ${result.error}`);
      return;
    }

    console.log(`📈 ${testName} Results:`);
    console.log(`   Throughput: ${result.throughput.average.toFixed(2)} req/sec (±${result.throughput.stddev.toFixed(2)})`);
    console.log(`   Latency: ${result.latency.average.toFixed(2)}ms avg, ${result.latency.p95.toFixed(2)}ms p95`);
    console.log(`   Requests: ${result.requests.total} total, ${result.errors} errors`);

    // Performance validation
    const passed = this.validatePerformance(result);
    console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  }

  /**
   * Validate performance against thresholds
   */
  validatePerformance(result) {
    return (
      result.throughput.average >= this.config.minThroughput &&
      result.latency.p95 <= this.config.maxLatency &&
      result.errors === 0
    );
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    console.log('\n📋 PERFORMANCE REPORT');
    console.log('=' .repeat(50));

    const summary = {
      totalTests: Object.keys(this.results).length,
      passedTests: 0,
      failedTests: 0,
      avgThroughput: 0,
      avgLatency: 0,
      totalErrors: 0
    };

    let validResults = 0;

    Object.entries(this.results).forEach(([testName, result]) => {
      if (result.error) {
        summary.failedTests++;
        console.log(`❌ ${testName}: ${result.error}`);
      } else {
        const passed = this.validatePerformance(result);
        if (passed) {
          summary.passedTests++;
        } else {
          summary.failedTests++;
        }

        summary.avgThroughput += result.throughput.average;
        summary.avgLatency += result.latency.average;
        summary.totalErrors += result.errors;
        validResults++;

        console.log(`${passed ? '✅' : '❌'} ${testName}:`);
        console.log(`   ${result.throughput.average.toFixed(2)} req/sec, ${result.latency.p95.toFixed(2)}ms p95`);
      }
    });

    if (validResults > 0) {
      summary.avgThroughput /= validResults;
      summary.avgLatency /= validResults;
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   Tests: ${summary.passedTests}/${summary.totalTests} passed`);
    console.log(`   Avg Throughput: ${summary.avgThroughput.toFixed(2)} req/sec`);
    console.log(`   Avg Latency: ${summary.avgLatency.toFixed(2)}ms`);
    console.log(`   Total Errors: ${summary.totalErrors}`);

    const overallScore = (summary.passedTests / summary.totalTests) * 100;
    console.log(`   Overall Score: ${overallScore.toFixed(1)}%`);

    if (overallScore >= 80) {
      console.log('🏆 EXCELLENT performance!');
    } else if (overallScore >= 60) {
      console.log('✅ GOOD performance');
    } else {
      console.log('⚠️  NEEDS IMPROVEMENT');
    }

    return summary;
  }

  /**
   * Run memory stress test
   */
  async runMemoryStressTest() {
    console.log('\n🧠 Running memory stress test...');

    const initialMemory = process.memoryUsage();
    const testData = [];

    // Simulate processing large datasets
    for (let i = 0; i < 1000; i++) {
      testData.push({
        tokens: Array(1000).fill(null).map((_, j) => ({
          address: `token-${i}-${j}`,
          symbol: `TOK${i}${j}`,
          data: new Array(100).fill(Math.random())
        }))
      });

      if (i % 100 === 0) {
        const currentMemory = process.memoryUsage();
        console.log(`   Iteration ${i}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB heap`);
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    console.log(`📊 Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage();
      console.log(`📊 After GC: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB heap`);
    }

    return {
      initialMemory,
      finalMemory,
      memoryIncrease,
      passed: memoryIncrease < 500 * 1024 * 1024 // Less than 500MB increase
    };
  }

  /**
   * CPU intensive test
   */
  async runCPUStressTest() {
    console.log('\n⚡ Running CPU stress test...');

    return new Promise((resolve) => {
      if (isMainThread) {
        const numWorkers = require('os').cpus().length;
        const workers = [];
        const results = [];

        for (let i = 0; i < numWorkers; i++) {
          const worker = new Worker(__filename, {
            workerData: { task: 'cpu-stress', duration: 10000 }
          });

          worker.on('message', (result) => {
            results.push(result);
            if (results.length === numWorkers) {
              const avgOpsPerSec = results.reduce((sum, r) => sum + r.opsPerSecond, 0) / numWorkers;
              console.log(`📊 Average operations per second: ${avgOpsPerSec.toFixed(0)}`);
              resolve({ opsPerSecond: avgOpsPerSec, workers: numWorkers });
            }
          });

          workers.push(worker);
        }
      }
    });
  }

  /**
   * Database performance test
   */
  async runDatabaseStressTest() {
    console.log('\n🗄️  Running database stress test...');

    const operations = [
      'INSERT',
      'SELECT',
      'UPDATE',
      'DELETE'
    ];

    const results = {};

    for (const operation of operations) {
      const startTime = performance.now();

      // Simulate database operations
      for (let i = 0; i < 1000; i++) {
        await this.simulateDbOperation(operation);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const opsPerSecond = 1000 / (duration / 1000);

      results[operation] = {
        duration,
        opsPerSecond,
        avgLatency: duration / 1000
      };

      console.log(`   ${operation}: ${opsPerSecond.toFixed(0)} ops/sec`);
    }

    return results;
  }

  /**
   * Simulate database operation
   */
  async simulateDbOperation(operation) {
    return new Promise(resolve => {
      // Simulate varying database latency (1-10ms)
      const latency = Math.random() * 9 + 1;
      setTimeout(resolve, latency);
    });
  }

  /**
   * Run API rate limiting test
   */
  async runRateLimitTest() {
    console.log('\n🚦 Running rate limit test...');

    const rapidRequests = Array(100).fill(null).map((_, i) =>
      fetch(`${this.config.baseUrl}/api/tokens?test=${i}`)
        .then(res => ({ status: res.status, index: i }))
        .catch(err => ({ error: err.message, index: i }))
    );

    const results = await Promise.allSettled(rapidRequests);

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
    const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;
    const errors = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 Rate limit test results:`);
    console.log(`   Successful: ${successful}/100`);
    console.log(`   Rate limited: ${rateLimited}/100`);
    console.log(`   Errors: ${errors}/100`);

    return {
      total: 100,
      successful,
      rateLimited,
      errors,
      passed: rateLimited > 0 // Should trigger rate limiting
    };
  }
}

// Worker thread CPU stress task
if (!isMainThread && workerData?.task === 'cpu-stress') {
  const startTime = performance.now();
  let operations = 0;

  while (performance.now() - startTime < workerData.duration) {
    // CPU intensive calculation
    Math.sqrt(Math.random() * 1000000);
    operations++;
  }

  const actualDuration = performance.now() - startTime;
  const opsPerSecond = operations / (actualDuration / 1000);

  parentPort.postMessage({ opsPerSecond, operations, duration: actualDuration });
}

module.exports = { PerformanceTester };

// CLI interface
if (require.main === module) {
  const tester = new PerformanceTester({
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    duration: parseInt(process.env.TEST_DURATION) || 30,
    connections: parseInt(process.env.TEST_CONNECTIONS) || 10
  });

  async function runAllTests() {
    try {
      console.log('🚀 Starting comprehensive performance testing suite...\n');

      // Load tests
      await tester.runLoadTests();

      // Stress tests
      const memoryResult = await tester.runMemoryStressTest();
      const cpuResult = await tester.runCPUStressTest();
      const dbResult = await tester.runDatabaseStressTest();
      const rateLimitResult = await tester.runRateLimitTest();

      console.log('\n🏁 All performance tests completed!');

      // Final summary
      const allPassed = memoryResult.passed &&
                       cpuResult.opsPerSecond > 10000 &&
                       rateLimitResult.passed;

      console.log(`\n${allPassed ? '✅' : '❌'} Overall performance: ${allPassed ? 'PASS' : 'FAIL'}`);

    } catch (error) {
      console.error('❌ Performance testing failed:', error);
      process.exit(1);
    }
  }

  runAllTests();
}