#!/bin/bash

# Auto-Fix Unicode Encoding Issues for Claude Code
# This script automatically detects and fixes Unicode encoding issues
# that cause API 400 "no low surrogate" errors

# DO NOT use set -e - this script must never fail or it corrupts Claude Code's message protocol
set +e

# Configuration
UNICODE_CACHE_TTL=${UNICODE_CACHE_TTL:-300}  # 5 minutes cache
UNICODE_CACHE_FILE=".unicode_check_cache"
UNICODE_AUTO_FIX=${UNICODE_AUTO_FIX:-true}    # Can be disabled via env var

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅${NC} $1"
}

# Quick opt-out for performance or user preference
if [ "$UNICODE_AUTO_FIX" = "false" ]; then
    exit 0
fi

# 🚨 CRITICAL: Silent mode for Claude Code hook context
# Prevents tool_use/tool_result API corruption by suppressing output
# when running as PreToolUse hook
CLAUDE_HOOK_SILENT=${CLAUDE_HOOK_SILENT:-false}
CLAUDE_PRE_TOOL_HOOK=${CLAUDE_PRE_TOOL_HOOK:-false}

# Auto-detect if we're running in a hook context that could interfere with tool conversations
if [ -n "$CLAUDE_TOOL_USE_ID" ] || [ "$CLAUDE_PRE_TOOL_HOOK" = "true" ] || [ "$CLAUDE_HOOK_SILENT" = "true" ]; then
    # Redirect all output to null to prevent tool_use/tool_result corruption
    exec > /dev/null 2>&1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Not in project root directory"
    exit 1
fi

# Check if npm scripts exist
if ! npm run | grep -q "check-unicode"; then
    log_warning "Unicode check script not found, skipping Unicode validation"
    exit 0
fi

# Performance optimization: Check cache to avoid frequent scans
check_cache() {
    if [ -f "$UNICODE_CACHE_FILE" ]; then
        local cache_time=$(stat -c %Y "$UNICODE_CACHE_FILE" 2>/dev/null || echo "0")
        local current_time=$(date +%s)
        local cache_age=$((current_time - cache_time))

        if [ $cache_age -lt $UNICODE_CACHE_TTL ]; then
            local cached_result=$(cat "$UNICODE_CACHE_FILE" 2>/dev/null || echo "dirty")
            if [ "$cached_result" = "clean" ]; then
                # Cache hit: recently checked and was clean
                exit 0
            fi
        fi
    fi
}

# Check cache first for performance
check_cache

log "🔍 Checking for Unicode encoding issues..."

# Run the check in quiet mode to get just the result
if npm run check-unicode > /dev/null 2>&1; then
    log_success "No Unicode encoding issues found"
    # Cache the clean result
    echo "clean" > "$UNICODE_CACHE_FILE"
    exit 0
else
    log_warning "Unicode encoding issues detected"

    # Show the actual check output for debugging
    echo ""
    echo "=== Unicode Check Output ==="
    npm run check-unicode 2>&1 | head -20
    echo "==========================="
    echo ""

    log "🛠️ Attempting automatic fix..."

    # Clear cache since issues were found
    rm -f "$UNICODE_CACHE_FILE"

    # Try to fix the issues
    if npm run fix-unicode > /dev/null 2>&1; then
        log_success "Unicode encoding issues fixed automatically"

        # Verify the fix worked
        if npm run check-unicode > /dev/null 2>&1; then
            log_success "✨ Unicode encoding self-healing completed successfully"
            # Cache the clean result after successful fix
            echo "clean" > "$UNICODE_CACHE_FILE"
            exit 0
        else
            log_error "Fix applied but issues still remain"
            echo ""
            echo "=== Remaining Issues ==="
            npm run check-unicode 2>&1 | tail -10
            echo "========================"
            exit 1
        fi
    else
        log_error "Failed to automatically fix Unicode encoding issues"
        echo ""
        echo "=== Fix Attempt Output ==="
        npm run fix-unicode 2>&1 | tail -10
        echo "=========================="
        echo ""
        log_error "Manual intervention required:"
        echo "  1. Check the Unicode fix report in the project root"
        echo "  2. Examine backup files in unicode_fix_backups/"
        echo "  3. Run 'npm run check-unicode' to see detailed issues"
        exit 1
    fi
fi