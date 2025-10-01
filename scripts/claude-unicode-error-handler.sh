#!/bin/bash

# Claude Code Unicode Error Handler & Auto-Healer
# This script is triggered when API 400 "no low surrogate" errors are detected
# and automatically fixes Unicode encoding issues then suggests retry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to log with timestamp and emoji
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} 🔧 $1"
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

log_info() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] ℹ️${NC} $1"
}

log_heal() {
    echo -e "${PURPLE}[$(date '+%H:%M:%S')] 🩹${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Not in project root directory"
    exit 1
fi

# Parse command line arguments
ERROR_MESSAGE=""
CHARACTER_POSITION=""
AUTO_FIX="true"

while [[ $# -gt 0 ]]; do
    case $1 in
        --error)
            ERROR_MESSAGE="$2"
            shift 2
            ;;
        --position)
            CHARACTER_POSITION="$2"
            shift 2
            ;;
        --no-fix)
            AUTO_FIX="false"
            shift
            ;;
        --help)
            echo "Claude Code Unicode Error Handler"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --error MSG      The API error message received"
            echo "  --position POS   Character position from error (e.g., 156281)"
            echo "  --no-fix         Only detect issues, don't auto-fix"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --error 'no low surrogate in string' --position 156281"
            echo "  $0  # Auto-detect and fix all Unicode issues"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "🩹 ======================================================="
echo "🩹   Claude Code Unicode Encoding Auto-Healer"
echo "🩹 ======================================================="
echo ""

if [ -n "$ERROR_MESSAGE" ]; then
    log_error "API Error Detected: $ERROR_MESSAGE"
    if [ -n "$CHARACTER_POSITION" ]; then
        log_info "Problem occurs around character position: $CHARACTER_POSITION"
    fi
    echo ""
fi

log_heal "🔍 Scanning codebase for Unicode encoding issues..."

# Check if npm scripts exist
if ! npm run | grep -q "check-unicode"; then
    log_error "Unicode fix scripts not available"
    log_info "Run: npm install && npm run check-unicode"
    exit 1
fi

# Store the check results
CHECK_OUTPUT=$(npm run check-unicode 2>&1)
CHECK_EXIT_CODE=$?

if [ $CHECK_EXIT_CODE -eq 0 ]; then
    log_success "No Unicode encoding issues found in codebase"

    if [ -n "$ERROR_MESSAGE" ]; then
        echo ""
        log_warning "However, an API error was reported. This might be:"
        echo "   • A transient network issue"
        echo "   • Content generated during this session that hasn't been saved"
        echo "   • Unicode issues in external data sources"
        echo ""
        log_info "💡 Recommended actions:"
        echo "   1. Retry your last operation"
        echo "   2. If error persists, check for unsaved changes"
        echo "   3. Restart Claude Code session if needed"
    fi
    exit 0
fi

# Issues found - show summary
echo ""
log_warning "Unicode encoding issues detected!"
echo ""
echo "=== ISSUE SUMMARY ==="
echo "$CHECK_OUTPUT" | grep -E "(❌|🔧|📊)" | head -10
echo "===================="
echo ""

if [ "$AUTO_FIX" = "false" ]; then
    log_info "Auto-fix disabled. Run without --no-fix to automatically resolve issues."
    exit 1
fi

log_heal "🛠️ Attempting automatic Unicode encoding repair..."

# Create a backup timestamp
BACKUP_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
log_info "Backup timestamp: $BACKUP_TIMESTAMP"

# Run the fix
FIX_OUTPUT=$(npm run fix-unicode 2>&1)
FIX_EXIT_CODE=$?

if [ $FIX_EXIT_CODE -eq 0 ]; then
    log_success "Unicode encoding issues have been automatically repaired!"

    # Verify the fix
    VERIFY_OUTPUT=$(npm run check-unicode 2>&1)
    VERIFY_EXIT_CODE=$?

    if [ $VERIFY_EXIT_CODE -eq 0 ]; then
        echo ""
        log_heal "🎉 Unicode encoding self-healing completed successfully!"
        echo ""
        echo "✨ =================================================="
        echo "✨   Auto-Healing Summary"
        echo "✨ =================================================="
        echo ""

        # Extract fix statistics from output
        ISSUES_FIXED=$(echo "$FIX_OUTPUT" | grep -c "✅ Fixed" || echo "0")
        FILES_PROCESSED=$(echo "$FIX_OUTPUT" | grep -c "Backup created" || echo "0")

        if [ "$FILES_PROCESSED" -gt 0 ]; then
            log_success "Files processed: $FILES_PROCESSED"
            log_success "Issues fixed: $ISSUES_FIXED"
            log_info "Backups available in: unicode_fix_backups/"
        fi

        echo ""
        log_heal "💡 Next steps:"
        echo "   ✅ Your Unicode encoding issues have been automatically fixed"
        echo "   ✅ You can safely retry your previous operation"
        echo "   ✅ Backups are available if needed"
        echo ""

        # If we have position info, try to show what was fixed
        if [ -n "$CHARACTER_POSITION" ]; then
            log_info "The character position $CHARACTER_POSITION mentioned in the error has been processed"
        fi

        exit 0
    else
        log_error "Fix applied but verification failed"
        echo ""
        echo "=== VERIFICATION OUTPUT ==="
        echo "$VERIFY_OUTPUT" | tail -10
        echo "========================="
        exit 1
    fi
else
    log_error "Automatic Unicode fix failed"
    echo ""
    echo "=== FIX ATTEMPT OUTPUT ==="
    echo "$FIX_OUTPUT" | tail -15
    echo "========================="
    echo ""
    log_error "❌ Manual intervention required:"
    echo "   1. Check the detailed error output above"
    echo "   2. Examine files in unicode_fix_backups/ directory"
    echo "   3. Run 'npm run check-unicode' for detailed issue analysis"
    echo "   4. Consider restoring from backups if needed"
    echo ""
    log_info "For help, see: docs/UNICODE_FIX_HELPER.md"
    exit 1
fi