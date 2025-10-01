#!/usr/bin/env node

/**
 * Claude Unicode Encoding Fix Helper (Node.js version)
 *
 * This script automatically detects and fixes Unicode encoding issues that cause
 * API 400 errors with "no low surrogate in string" messages.
 *
 * Usage:
 *   node scripts/fix-unicode-encoding.mjs
 *   node scripts/fix-unicode-encoding.mjs --check-only
 *   node scripts/fix-unicode-encoding.mjs --file path/to/file.md
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UnicodeEncodingFixer {
  constructor(backupDir = 'unicode_fix_backups') {
    this.backupDir = backupDir;
    this.issuesFound = [];
    this.filesFixed = [];
  }

  async init() {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  getLineColumn(content, position) {
    const lines = content.substring(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  logIssue(filename, issueType, position, description, content) {
    const { line, column } = this.getLineColumn(content, position);
    const issue = {
      file: filename,
      type: issueType,
      position,
      line,
      column,
      description,
      timestamp: new Date().toISOString()
    };
    this.issuesFound.push(issue);
    console.log(`🚨 ${filename}:${line}:${column} - ${issueType}: ${description}`);
  }

  async backupFile(filepath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${path.basename(filepath)}_${timestamp}.backup`);
    await fs.copyFile(filepath, backupPath);
    console.log(`📦 Backup created: ${backupPath}`);
    return backupPath;
  }

  detectEncodingIssues(content, filename) {
    const issues = [];

    // Check for unpaired surrogates - this works in Node.js unlike Python
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);

      // High surrogate check
      if (code >= 0xD800 && code <= 0xDBFF) {
        // Check if followed by valid low surrogate
        if (i + 1 >= content.length ||
            content.charCodeAt(i + 1) < 0xDC00 ||
            content.charCodeAt(i + 1) > 0xDFFF) {
          issues.push({
            type: 'unpaired_high_surrogate',
            position: i,
            char: content[i],
            codepoint: `0x${code.toString(16).toUpperCase()}`
          });
        }
      }
      // Low surrogate check
      else if (code >= 0xDC00 && code <= 0xDFFF) {
        // Check if preceded by valid high surrogate
        if (i === 0 ||
            content.charCodeAt(i - 1) < 0xD800 ||
            content.charCodeAt(i - 1) > 0xDBFF) {
          issues.push({
            type: 'unpaired_low_surrogate',
            position: i,
            char: content[i],
            codepoint: `0x${code.toString(16).toUpperCase()}`
          });
        }
      }
      // Other problematic characters
      else if (code === 0x0000) {
        issues.push({
          type: 'null_character',
          position: i,
          char: content[i],
          codepoint: '0x0000'
        });
      }
      else if (code === 0xFFFE || code === 0xFFFF) {
        issues.push({
          type: 'non_character',
          position: i,
          char: content[i],
          codepoint: `0x${code.toString(16).toUpperCase()}`
        });
      }
    }

    return issues;
  }

  fixEncodingIssues(content, issues) {
    let fixedContent = content;
    let offset = 0;

    // Sort issues by position (reverse order to maintain indices)
    const sortedIssues = issues.sort((a, b) => b.position - a.position);

    for (const issue of sortedIssues) {
      const pos = issue.position;
      const { type } = issue;

      if (type === 'unpaired_high_surrogate' || type === 'unpaired_low_surrogate') {
        // Replace unpaired surrogates with replacement character
        fixedContent = fixedContent.slice(0, pos) + '\uFFFD' + fixedContent.slice(pos + 1);
        console.log(`  ✅ Fixed ${type} at position ${pos}`);
      }
      else if (type === 'null_character') {
        // Remove null characters
        fixedContent = fixedContent.slice(0, pos) + fixedContent.slice(pos + 1);
        console.log(`  ✅ Removed null character at position ${pos}`);
      }
      else if (type === 'non_character') {
        // Replace non-characters with replacement character
        fixedContent = fixedContent.slice(0, pos) + '\uFFFD' + fixedContent.slice(pos + 1);
        console.log(`  ✅ Replaced non-character at position ${pos}`);
      }
    }

    return fixedContent;
  }

  async checkFile(filepath, fixIssues = false) {
    try {
      let content;

      try {
        // Read file as buffer first, then convert to string to preserve encoding issues
        const buffer = await fs.readFile(filepath);
        content = buffer.toString('utf8');
      } catch (error) {
        this.logIssue(filepath, 'file_read_error', 0, `Cannot read file: ${error.message}`, '');
        return false;
      }

      // Detect issues
      const issues = this.detectEncodingIssues(content, filepath);

      if (issues.length === 0) {
        return true;
      }

      // Log all issues
      for (const issue of issues) {
        this.logIssue(
          filepath,
          issue.type,
          issue.position,
          `Character ${issue.codepoint} at position ${issue.position}`,
          content
        );
      }

      if (fixIssues) {
        // Create backup
        await this.backupFile(filepath);

        // Fix issues
        const fixedContent = this.fixEncodingIssues(content, issues);

        // Write fixed content
        await fs.writeFile(filepath, fixedContent, 'utf8');

        this.filesFixed.push(filepath);
        console.log(`✅ Fixed ${issues.length} issues in ${filepath}`);
        return true;
      }

      return false;

    } catch (error) {
      this.logIssue(filepath, 'processing_error', 0, `Error processing file: ${error.message}`, '');
      return false;
    }
  }

  async scanProject(fixIssues = false, targetFile = null) {
    console.log('🔍 Scanning for Unicode encoding issues...');

    let filesToCheck;

    if (targetFile) {
      filesToCheck = [targetFile];
    } else {
      // Find all text files using glob patterns
      const patterns = [
        '**/*.md',
        '**/*.MD',
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.json',
        '**/*.txt'
      ];

      filesToCheck = [];
      for (const pattern of patterns) {
        const files = await glob(pattern, {
          ignore: [
            'node_modules/**',
            '.git/**',
            'dist/**',
            'build/**',
            'coverage/**',
            'unicode_fix_backups/**'
          ]
        });
        filesToCheck.push(...files);
      }

      // Remove duplicates
      filesToCheck = [...new Set(filesToCheck)];
    }

    console.log(`📁 Checking ${filesToCheck.length} files...`);

    let cleanFiles = 0;
    let problematicFiles = 0;

    for (const filepath of filesToCheck) {
      if (await this.checkFile(filepath, fixIssues)) {
        cleanFiles++;
      } else {
        problematicFiles++;
      }
    }

    // Generate report
    await this.generateReport(cleanFiles, problematicFiles, fixIssues);

    return this.issuesFound.length === 0;
  }

  async generateReport(cleanFiles, problematicFiles, fixesApplied) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 UNICODE ENCODING SCAN REPORT');
    console.log('='.repeat(60));
    console.log(`✅ Clean files: ${cleanFiles}`);
    console.log(`❌ Problematic files: ${problematicFiles}`);
    console.log(`🔧 Issues found: ${this.issuesFound.length}`);

    if (fixesApplied) {
      console.log(`🛠️  Files fixed: ${this.filesFixed.length}`);
    }

    if (this.issuesFound.length > 0) {
      console.log('\n📋 DETAILED ISSUES:');
      for (const issue of this.issuesFound) {
        console.log(`  ${issue.file}:${issue.line}:${issue.column} - ${issue.type}`);
      }
    }


    if (fixesApplied && this.filesFixed.length > 0) {
      console.log(`📦 Backups available in: ${this.backupDir}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  const checkOnly = args.includes('--check-only');
  const fileIndex = args.indexOf('--file');
  const targetFile = fileIndex !== -1 ? args[fileIndex + 1] : null;
  const backupDirIndex = args.indexOf('--backup-dir');
  const backupDir = backupDirIndex !== -1 ? args[backupDirIndex + 1] : 'unicode_fix_backups';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Unicode Encoding Fix Helper

Usage:
  node scripts/fix-unicode-encoding.mjs [options]

Options:
  --check-only     Only check for issues, do not fix them
  --file <path>    Check specific file instead of entire project
  --backup-dir <path>  Directory for backup files (default: unicode_fix_backups)
  --help, -h       Show this help message

Examples:
  node scripts/fix-unicode-encoding.mjs --check-only
  node scripts/fix-unicode-encoding.mjs --file src/App.tsx
  node scripts/fix-unicode-encoding.mjs
`);
    process.exit(0);
  }

  const fixer = new UnicodeEncodingFixer(backupDir);

  try {
    await fixer.init();

    const success = await fixer.scanProject(!checkOnly, targetFile);

    if (success) {
      console.log('\n🎉 All files are clean! No Unicode encoding issues found.');
      process.exit(0);
    } else {
      if (checkOnly) {
        console.log('\n⚠️  Issues found. Run without --check-only to fix them.');
        process.exit(1);
      } else {
        console.log('\n✅ Issues have been fixed. Check the report for details.');
        process.exit(0);
      }
    }

  } catch (error) {
    if (error.code === 'SIGINT') {
      console.log('\n⏹️  Operation cancelled by user');
      process.exit(1);
    } else {
      console.error(`\n💥 Unexpected error: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}