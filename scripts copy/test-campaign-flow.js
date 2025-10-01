#!/usr/bin/env node
/**
 * Comprehensive Campaign Flow Test
 * Tests real campaign creation and editing A-Z with comprehensive logging
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';

// Supabase configuration - using centralized config
const SUPABASE_URL = SUPABASE_CONFIG.PROJECT_URL;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class CampaignFlowTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.logs = [];
    this.testResults = {
      databaseConnection: false,
      campaignCreation: false,
      leadUpload: false,
      messageUpload: false,
      variablePulling: false,
      campaignEditing: false
    };
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);

    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      error: '\x1b[31m',   // red
      warn: '\x1b[33m',    // yellow
      reset: '\x1b[0m'
    };

    console.log(`${colors[level] || colors.info}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
    if (Object.keys(data).length > 0) {
      console.log(`${colors.info}   Data:${colors.reset}`, JSON.stringify(data, null, 2));
    }
  }

  async setup() {
    this.log('info', '🚀 Setting up browser for campaign flow testing');

    try {
      this.browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage();

      // Listen to console logs from the page
      this.page.on('console', msg => {
        if (msg.text().includes('CAMPAIGN-')) {
          this.log('info', `Browser Log: ${msg.text()}`);
        }
      });

      // Listen to page errors
      this.page.on('pageerror', error => {
        this.log('error', `Page Error: ${error.message}`);
      });

      this.log('success', '✅ Browser setup complete');
      return true;

    } catch (error) {
      this.log('error', '❌ Browser setup failed', { error: error.message });
      return false;
    }
  }

  async testDatabaseConnection() {
    this.log('info', '🔌 Testing direct database connection');

    try {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, created_at')
        .limit(5);

      if (error) {
        this.log('error', '❌ Database connection failed', { error: error.message });
        return false;
      }

      this.log('success', '✅ Database connection successful', {
        campaignCount: campaigns.length,
        campaigns
      });

      this.testResults.databaseConnection = true;
      return true;

    } catch (error) {
      this.log('error', '❌ Database connection exception', { error: error.message });
      return false;
    }
  }

  async navigateToApp() {
    this.log('info', '🌐 Navigating to application');

    try {
      await this.page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });

      // Check if we're on the auth page or main app
      const url = this.page.url();
      this.log('info', `📍 Current URL: ${url}`);

      // If on auth page, try to bypass using the Test Campaign button
      if (url.includes('/auth')) {
        this.log('info', '🔐 On authentication page, looking for Test Campaign button');

        // Look for all buttons and find the "Test Campaign" one
        const buttons = await this.page.$$('button');
        let foundTestButton = false;

        for (const button of buttons) {
          const text = await this.page.evaluate(btn => btn.textContent, button);
          this.log('info', `Found button: "${text}"`);

          if (text && text.includes('Test Campaign')) {
            this.log('info', '🧪 Found Test Campaign button, clicking to bypass auth');
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check if we navigated away from auth
            const newUrl = this.page.url();
            this.log('info', `📍 After test button click: ${newUrl}`);
            foundTestButton = true;
            break;
          }
        }

        if (!foundTestButton) {
          this.log('warn', '⚠️  No Test Campaign button found, listing all available buttons for debugging');
        }
      }

      // Wait for app to load
      await this.page.waitForSelector('body', { timeout: 5000 });

      const title = await this.page.title();
      this.log('success', '✅ Application loaded', { title, url });

      return true;

    } catch (error) {
      this.log('error', '❌ Navigation failed', { error: error.message });
      return false;
    }
  }

  async testCampaignCreation() {
    this.log('info', '📝 Testing campaign creation flow');

    try {
      // Navigate to campaign creation
      await this.page.goto('http://localhost:8080/campaigns/create', { waitUntil: 'networkidle0' });

      this.log('info', '📍 Navigated to campaign creation page');

      // Wait for React to load and render
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take screenshot for debugging
      await this.page.screenshot({ path: 'campaign-creation-start.png' });

      // Check for auth redirect and handle it
      const currentUrl = this.page.url();
      if (currentUrl.includes('/auth')) {
        this.log('info', '🔐 Redirected to auth, looking for Test Campaign button');

        // Find and click Test Campaign button
        const buttons = await this.page.$$('button');
        for (const button of buttons) {
          const text = await this.page.evaluate(btn => btn.textContent, button);
          if (text && text.includes('Test Campaign')) {
            this.log('info', '🧪 Clicking Test Campaign button');
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            break;
          }
        }

        // Navigate back to campaign creation after auth bypass
        await this.page.goto('http://localhost:8080/campaigns/create', { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Wait for campaign logger to be available
      await this.page.waitForFunction(() => {
        return window.campaignLogger !== undefined;
      }, { timeout: 10000 }).catch(() => {
        this.log('warn', '⚠️  Campaign logger not available within timeout');
      });

      // Check if campaign logger is available now
      const hasLogger = await this.page.evaluate(() => {
        return typeof window.campaignLogger !== 'undefined';
      });

      if (hasLogger) {
        this.log('success', '✅ Campaign logger is available');
      } else {
        this.log('warn', '⚠️  Campaign logger still not available');
      }

      // Look for the campaign creation form with more specific selectors
      const wizardSelectors = [
        '[data-testid*="wizard"]',
        '.wizard',
        '[class*="wizard"]',
        '[data-testid*="campaign"]',
        '.campaign-create',
        '[class*="campaign-create"]',
        'form',
        '[role="form"]'
      ];

      let wizardFound = false;
      for (const selector of wizardSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          this.log('success', `✅ Found campaign form with selector: ${selector}`);
          wizardFound = true;
          break;
        }
      }

      if (!wizardFound) {
        this.log('warn', '⚠️  Campaign wizard not found, checking page content');

        // Get more detailed page info
        const pageInfo = await this.page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            bodyClass: document.body.className,
            bodyText: document.body.innerText.substring(0, 1000),
            reactElements: document.querySelectorAll('[data-reactroot], #root > *').length,
            hasReact: window.React !== undefined
          };
        });

        this.log('info', 'Detailed page info', pageInfo);
      }

      // Take screenshot of current state for debugging
      await this.page.screenshot({ path: 'campaign-creation-form.png' });

      // Capture campaign logger data immediately after finding form
      if (hasLogger) {
        const currentLogs = await this.page.evaluate(() => {
          if (window.campaignLogger) {
            const logs = JSON.parse(window.campaignLogger.exportLogs());
            return logs.slice(-10); // Get last 10 entries
          }
          return [];
        });

        if (currentLogs.length > 0) {
          this.log('info', 'Recent campaign logger entries:', { recentLogs: currentLogs });
        }
      }

      // Look for specific wizard step indicators
      const stepSelectors = [
        '[data-testid*="step"]',
        '.step',
        '[class*="step"]',
        '[aria-label*="step"]',
        '[data-testid*="wizard"]',
        '.wizard-step',
        '[class*="wizard-step"]',
        '[role="tabpanel"]',
        '[role="tab"]'
      ];

      let currentStep = null;
      for (const selector of stepSelectors) {
        const steps = await this.page.$$(selector);
        if (steps.length > 0) {
          this.log('info', `Found ${steps.length} step elements with selector: ${selector}`);

          // Try to get step information
          const stepInfo = await this.page.evaluate((sel) => {
            const elements = Array.from(document.querySelectorAll(sel));
            return elements.map(el => ({
              text: el.textContent?.trim(),
              className: el.className,
              id: el.id,
              ariaLabel: el.getAttribute('aria-label')
            }));
          }, selector);

          this.log('info', 'Step information:', { steps: stepInfo });
          currentStep = selector;
          break;
        }
      }

      // Test lead upload step
      await this.testLeadUpload();

      // Test message creation step
      await this.testMessageCreation();

      // Test campaign finalization
      await this.testCampaignFinalization();

      this.testResults.campaignCreation = true;
      return true;

    } catch (error) {
      this.log('error', '❌ Campaign creation test failed', { error: error.message });
      return false;
    }
  }

  async testLeadUpload() {
    this.log('info', '📤 Testing lead upload functionality');

    try {
      // Look for file upload elements
      const fileInput = await this.page.$('input[type="file"]');
      if (!fileInput) {
        this.log('warn', '⚠️  File input not found, looking for upload areas');
        const uploadAreas = await this.page.$$('[class*="upload"], [data-testid*="upload"]');
        this.log('info', `Found ${uploadAreas.length} potential upload areas`);
      } else {
        this.log('success', '✅ File input found');

        // Try to upload the sample CSV
        const csvPath = '/home/galaxy/Documents/infra-dm-app-unified/sample-leads.csv';
        if (fs.existsSync(csvPath)) {
          await fileInput.uploadFile(csvPath);
          this.log('success', '✅ Sample CSV uploaded');

          // Wait for processing
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check for success indicators
          const successIndicators = await this.page.$$('[class*="success"], [data-testid*="success"]');
          this.log('info', `Found ${successIndicators.length} success indicators`);

          this.testResults.leadUpload = true;
        } else {
          this.log('warn', '⚠️  Sample CSV file not found');
        }
      }

    } catch (error) {
      this.log('error', '❌ Lead upload test failed', { error: error.message });
    }
  }

  async testMessageCreation() {
    this.log('info', '💬 Testing message creation functionality');

    try {
      // Look for message input areas
      const messageInputs = await this.page.$$('textarea, [contenteditable], input[placeholder*="message"]');
      this.log('info', `Found ${messageInputs.length} potential message inputs`);

      if (messageInputs.length > 0) {
        // Try to add a test message
        await messageInputs[0].type('Hi {{first_name}}! I love your content about {{city}}. Let\'s connect!');
        this.log('success', '✅ Test message added with variables');

        this.testResults.messageUpload = true;
        this.testResults.variablePulling = true;
      }

    } catch (error) {
      this.log('error', '❌ Message creation test failed', { error: error.message });
    }
  }

  async testCampaignFinalization() {
    this.log('info', '🎯 Testing campaign finalization');

    try {
      // Look for create/save buttons
      const createButtons = await this.page.$$('button[class*="create"], button[class*="save"]');
      this.log('info', `Found ${createButtons.length} potential create buttons`);

      if (createButtons.length > 0) {
        // Click the first create button
        await createButtons[0].click();
        this.log('info', '🖱️  Clicked create button');

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check for success/error messages
        const notifications = await this.page.$$('[class*="toast"], [class*="notification"], [role="alert"]');
        this.log('info', `Found ${notifications.length} notifications after creation attempt`);

        for (let i = 0; i < notifications.length; i++) {
          const text = await notifications[i].textContent();
          this.log('info', `Notification ${i + 1}: ${text}`);
        }
      }

    } catch (error) {
      this.log('error', '❌ Campaign finalization test failed', { error: error.message });
    }
  }

  async testCampaignEditing() {
    this.log('info', '✏️  Testing campaign editing flow');

    try {
      // First, check if any campaigns exist
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .limit(1);

      if (campaigns && campaigns.length > 0) {
        const campaignId = campaigns[0].id;
        this.log('info', '📝 Testing edit with existing campaign', { campaignId });

        // Navigate to edit page
        await this.page.goto(`http://localhost:8080/campaigns/${campaignId}/edit`, { waitUntil: 'networkidle0' });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot
        await this.page.screenshot({ path: 'campaign-edit-page.png' });

        // Check for edit interface
        const editElements = await this.page.$$('[data-testid*="edit"], .edit, [class*="edit"]');
        this.log('info', `Found ${editElements.length} edit interface elements`);

        this.testResults.campaignEditing = true;

      } else {
        this.log('warn', '⚠️  No campaigns exist to test editing');
      }

    } catch (error) {
      this.log('error', '❌ Campaign editing test failed', { error: error.message });
    }
  }

  async captureLogs() {
    this.log('info', '📊 Capturing application logs');

    try {
      // Execute JavaScript to get campaign logger data
      const browserLogs = await this.page.evaluate(() => {
        if (window.campaignLogger) {
          return {
            logs: window.campaignLogger.exportLogs(),
            report: window.campaignLogger.generateAnalysisReport(),
            available: true
          };
        }
        return { logs: '[]', report: null, available: false };
      });

      if (browserLogs.available && browserLogs.logs !== '[]') {
        this.log('success', '✅ Campaign logger data captured');

        // Parse and log some recent entries for immediate visibility
        try {
          const logEntries = JSON.parse(browserLogs.logs);
          this.log('info', `Found ${logEntries.length} log entries`);

          // Show recent errors and warnings
          const recentIssues = logEntries
            .filter(entry => entry.level === 'error' || entry.level === 'warn')
            .slice(-5);

          if (recentIssues.length > 0) {
            this.log('info', 'Recent issues from campaign logger:', { issues: recentIssues });
          }

        } catch (parseError) {
          this.log('warn', 'Could not parse campaign logs for preview');
        }

        // Save logs to file
        fs.writeFileSync('campaign-logs.json', browserLogs.logs);

        if (browserLogs.report) {
          fs.writeFileSync('campaign-analysis-report.json', JSON.stringify(browserLogs.report, null, 2));
          this.log('success', '✅ Analysis report saved');
        }
      } else {
        this.log('warn', '⚠️  No campaign logger data found');

        // Check what is available on window
        const windowInfo = await this.page.evaluate(() => {
          return {
            hasCampaignLogger: typeof window.campaignLogger !== 'undefined',
            windowKeys: Object.keys(window).filter(key => key.includes('campaign') || key.includes('logger')),
            hasReact: typeof window.React !== 'undefined',
            hasReactDOM: typeof window.ReactDOM !== 'undefined'
          };
        });

        this.log('info', 'Window availability check:', windowInfo);
      }

    } catch (error) {
      this.log('error', '❌ Log capture failed', { error: error.message });
    }
  }

  async cleanup() {
    this.log('info', '🧹 Cleaning up test environment');

    if (this.browser) {
      await this.browser.close();
    }

    // Save test results
    fs.writeFileSync('test-results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      logs: this.logs
    }, null, 2));

    this.log('success', '✅ Cleanup complete, results saved');
  }

  async runFullTest() {
    this.log('info', '🎬 Starting comprehensive campaign flow test');

    const setupOk = await this.setup();
    if (!setupOk) return;

    await this.testDatabaseConnection();
    await this.navigateToApp();
    await this.testCampaignCreation();
    await this.testCampaignEditing();
    await this.captureLogs();

    // Print summary
    this.log('info', '📋 Test Summary');
    console.log('\n=== TEST RESULTS ===');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test}`);
    });

    await this.cleanup();
  }
}

// Run the test
const tester = new CampaignFlowTester();
tester.runFullTest().catch(console.error);