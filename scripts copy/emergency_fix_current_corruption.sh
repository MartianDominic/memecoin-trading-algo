#!/bin/bash
# Emergency Fix for Current Tool Use Corruption
# Fixes the NEW tool_use ID: toolu_01W9bnd9Qf7cwNDVkUJ8SLg6

set -e

CLAUDE_DIR="$HOME/.claude"
NEW_PROBLEMATIC_ID="toolu_01W9bnd9Qf7cwNDVkUJ8SLg6"

echo "🚨 EMERGENCY FIX: Current Tool Use Corruption"
echo "============================================="
echo
echo "New corrupted tool_use ID detected: $NEW_PROBLEMATIC_ID"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    case $1 in
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $2${NC}" ;;
    esac
}

echo "🔍 STEP 1: Find and backup affected files..."
affected_files=$(find "$CLAUDE_DIR/projects" -name "*.jsonl" -exec grep -l "$NEW_PROBLEMATIC_ID" {} \; 2>/dev/null || echo "")

if [ -z "$affected_files" ]; then
    print_status "WARNING" "No files found with current tool ID - may be in active memory"
    echo "The corruption might be in the current conversation state."
    echo
    echo "💡 IMMEDIATE ACTIONS NEEDED:"
    echo "1. 🛑 STOP current Claude Code conversation"
    echo "2. 🔄 RESTART Claude Code completely: pkill -f claude-code && claude-code"
    echo "3. 🧪 START FRESH conversation"
    echo "4. 🔧 Run the prevention setup if not done already"
    echo
    exit 0
fi

echo "📁 Found affected session files:"
echo "$affected_files"
echo

# Create emergency backup
backup_dir="$CLAUDE_DIR/emergency_backups_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

echo "$affected_files" | while read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$backup_dir/$(basename "$file")"
        print_status "SUCCESS" "Backed up: $(basename "$file")"
    fi
done

echo
echo "🧹 STEP 2: Clean corrupted entries..."
echo "$affected_files" | while read -r file; do
    if [ -f "$file" ]; then
        # Remove all lines containing the problematic tool ID
        grep -v "$NEW_PROBLEMATIC_ID" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
        print_status "SUCCESS" "Cleaned: $(basename "$file")"
    fi
done

echo
echo "⚡ STEP 3: IMMEDIATE RESTART REQUIRED"
echo "====================================="
print_status "WARNING" "Claude Code must be restarted NOW to clear in-memory corruption"
echo
echo "Run these commands IMMEDIATELY:"
echo "  pkill -f claude-code"
echo "  claude-code"
echo
echo "Then start a fresh conversation and test with a simple file read."
echo

print_status "SUCCESS" "Emergency fix complete - RESTART Claude Code now!"
echo "📁 Backups available in: $backup_dir"