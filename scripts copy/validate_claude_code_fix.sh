#!/bin/bash
# Claude Code Session File Repair Script
# Fixes tool_use/tool_result API Error 400 issues

set -e

CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/session_backups"
PROBLEMATIC_TOOL_ID="toolu_018YfMszTCKXmjK5VB2fZcji"

echo "🔧 Claude Code Session Repair Tool"
echo "=================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $1 in
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $2${NC}" ;;
    esac
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
timestamp=$(date +%Y%m%d_%H%M%S)

print_status "INFO" "Analyzing corrupted sessions..."

# Find all affected session files
affected_files=$(grep -l "$PROBLEMATIC_TOOL_ID" "$CLAUDE_DIR"/projects/*/*.jsonl 2>/dev/null || echo "")

if [ -z "$affected_files" ]; then
    print_status "SUCCESS" "No corrupted session files found with tool ID: $PROBLEMATIC_TOOL_ID"
    exit 0
fi

print_status "WARNING" "Found corrupted session files:"
echo "$affected_files" | while read -r file; do
    echo "   - $(basename "$file")"
done
echo

print_status "INFO" "Creating backups..."
echo "$affected_files" | while read -r file; do
    if [ -f "$file" ]; then
        backup_file="$BACKUP_DIR/$(basename "$file").backup.$timestamp"
        cp "$file" "$backup_file"
        print_status "SUCCESS" "Backed up: $(basename "$file")"
    fi
done
echo

echo "🔧 Repair Options:"
echo "=================="
echo "1. 🗑️  Remove corrupted entries (RECOMMENDED)"
echo "2. 🧹 Clean all sessions for this project"
echo "3. ℹ️  Show detailed analysis"
echo "4. ❌ Cancel"
echo

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo
        print_status "INFO" "Removing corrupted tool_use entries..."
        echo "$affected_files" | while read -r file; do
            if [ -f "$file" ]; then
                # Remove lines containing the problematic tool ID
                grep -v "$PROBLEMATIC_TOOL_ID" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
                print_status "SUCCESS" "Cleaned: $(basename "$file")"
            fi
        done
        echo
        print_status "SUCCESS" "Session files cleaned successfully!"
        print_status "INFO" "Please restart Claude Code to see if the issue is resolved."
        ;;
    2)
        echo
        print_status "INFO" "Cleaning all sessions for infra-dm-app-unified project..."
        project_dir="$CLAUDE_DIR/projects/-home-galaxy-Documents-infra-dm-app-unified"
        if [ -d "$project_dir" ]; then
            # Backup entire project directory
            cp -r "$project_dir" "$BACKUP_DIR/project_backup_$timestamp"
            print_status "SUCCESS" "Project backed up to: project_backup_$timestamp"

            # Remove all session files
            rm -f "$project_dir"/*.jsonl
            print_status "SUCCESS" "All session files removed"
            echo
            print_status "SUCCESS" "Project sessions cleaned!"
            print_status "INFO" "Next Claude Code session will start fresh."
        else
            print_status "ERROR" "Project directory not found: $project_dir"
        fi
        ;;
    3)
        echo
        echo "🔍 Detailed Analysis"
        echo "==================="
        echo "$affected_files" | while read -r file; do
            echo
            echo "📄 File: $(basename "$file")"
            echo "   Tool use entries:"
            grep -n "tool_use.*$PROBLEMATIC_TOOL_ID" "$file" | head -3
            echo "   Tool result entries:"
            grep -n "tool_result.*$PROBLEMATIC_TOOL_ID" "$file" | head -3
            echo "   System messages between:"
            grep -A 5 -B 5 "PreToolUse:Read" "$file" | grep -E "(tool_use|tool_result|PreToolUse)" || echo "   (none found)"
        done
        ;;
    4)
        print_status "INFO" "Operation cancelled."
        exit 0
        ;;
    *)
        print_status "ERROR" "Invalid option selected."
        exit 1
        ;;
esac

echo
echo "🎯 Next Steps:"
echo "1. Restart Claude Code: pkill -f claude-code && claude-code"
echo "2. Start a fresh conversation"
echo "3. Test with a simple tool operation (like reading a file)"
echo "4. If issues persist, try option 2 (clean all sessions)"
echo
echo "📁 Backups available in: $BACKUP_DIR"
echo "🔄 To restore: cp \$BACKUP_DIR/[file].backup.$timestamp [original_location]"