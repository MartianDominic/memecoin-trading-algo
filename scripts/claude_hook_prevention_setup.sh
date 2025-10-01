#!/bin/bash
# Claude Code Hook Prevention Setup
# Configures hooks to prevent tool_use/tool_result API corruption

set -e

CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
BACKUP_DIR="$CLAUDE_DIR/hook_backups"

echo "🔧 Claude Code Hook Prevention Setup"
echo "===================================="
echo

# Create backup directory
mkdir -p "$BACKUP_DIR"
timestamp=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    case $1 in
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $2${NC}" ;;
    esac
}

print_status "INFO" "Setting up prevention for tool_use/tool_result corruption..."

# Check if settings file exists
if [ ! -f "$SETTINGS_FILE" ]; then
    print_status "ERROR" "Claude settings file not found at $SETTINGS_FILE"
    exit 1
fi

print_status "SUCCESS" "Found Claude settings file"

# Backup settings file
backup_file="$BACKUP_DIR/settings.json.backup.$timestamp"
cp "$SETTINGS_FILE" "$backup_file"
print_status "SUCCESS" "Backed up settings to: $(basename "$backup_file")"

# Create the hook prevention configuration
cat > "$CLAUDE_DIR/hook_prevention_config.json" << 'EOF'
{
  "hook_prevention": {
    "version": "1.0",
    "description": "Prevents PreToolUse hooks from corrupting tool_use/tool_result API calls",
    "environment_variables": {
      "CLAUDE_HOOK_SILENT": "true",
      "CLAUDE_PRE_TOOL_HOOK": "true"
    },
    "hooks": {
      "preToolUse": {
        "command": "CLAUDE_PRE_TOOL_HOOK=true CLAUDE_HOOK_SILENT=true ./scripts/auto-fix-unicode.sh",
        "description": "Runs Unicode fix in silent mode to prevent API corruption"
      }
    }
  }
}
EOF

print_status "SUCCESS" "Created hook prevention configuration"

echo
print_status "INFO" "Hook Prevention Options:"
echo "1. 🔧 Auto-configure (modifies .claude/settings.json)"
echo "2. 📋 Show manual instructions"
echo "3. 🧪 Test current configuration"
echo "4. ❌ Cancel"
echo

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo
        print_status "INFO" "Auto-configuring hook prevention..."

        # Check if jq is available for JSON manipulation
        if command -v jq &> /dev/null; then
            # Use jq for proper JSON manipulation
            jq '.hooks.preToolUse = ["CLAUDE_PRE_TOOL_HOOK=true", "CLAUDE_HOOK_SILENT=true", "./scripts/auto-fix-unicode.sh"]' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
            print_status "SUCCESS" "Hook configuration updated with jq"
        else
            # Manual configuration message
            print_status "WARNING" "jq not available, manual configuration required"
            echo
            echo "Please manually edit ~/.claude/settings.json and modify the preToolUse hook:"
            echo
            echo "BEFORE:"
            echo '  "preToolUse": ["./scripts/auto-fix-unicode.sh"]'
            echo
            echo "AFTER:"
            echo '  "preToolUse": ["CLAUDE_PRE_TOOL_HOOK=true CLAUDE_HOOK_SILENT=true ./scripts/auto-fix-unicode.sh"]'
            echo
        fi
        ;;
    2)
        echo
        print_status "INFO" "Manual Configuration Instructions:"
        echo "================================="
        echo
        echo "1. Edit ~/.claude/settings.json"
        echo "2. Find the preToolUse hook configuration"
        echo "3. Replace the command with:"
        echo '   "CLAUDE_PRE_TOOL_HOOK=true CLAUDE_HOOK_SILENT=true ./scripts/auto-fix-unicode.sh"'
        echo
        echo "OR set environment variables globally:"
        echo "   export CLAUDE_HOOK_SILENT=true"
        echo "   export CLAUDE_PRE_TOOL_HOOK=true"
        echo
        ;;
    3)
        echo
        print_status "INFO" "Testing current hook configuration..."

        # Test by running the Unicode script with hook variables
        echo "Testing auto-fix-unicode.sh in hook mode..."
        if CLAUDE_PRE_TOOL_HOOK=true ./scripts/auto-fix-unicode.sh 2>&1; then
            print_status "SUCCESS" "Script runs silently in hook mode ✅"
        else
            print_status "WARNING" "Script may still produce output"
        fi

        # Test by checking for recent API errors
        echo
        echo "Checking for recent tool_use/tool_result errors..."
        if grep -r "tool_use.*without.*tool_result" "$CLAUDE_DIR/projects" 2>/dev/null | tail -1; then
            print_status "WARNING" "Recent API errors still found - may need cleanup"
        else
            print_status "SUCCESS" "No recent API errors detected"
        fi
        ;;
    4)
        print_status "INFO" "Setup cancelled"
        exit 0
        ;;
    *)
        print_status "ERROR" "Invalid option"
        exit 1
        ;;
esac

echo
print_status "SUCCESS" "Hook prevention setup complete!"
echo
echo "🎯 Next Steps:"
echo "1. Restart Claude Code to apply changes"
echo "2. Test with a simple tool operation"
echo "3. Run ./validate_claude_code_fix.sh to clean existing corruption"
echo "4. Monitor for API 400 errors (should not occur)"
echo
echo "📁 Backups stored in: $BACKUP_DIR"
echo "🔄 To restore: cp $backup_file ~/.claude/settings.json"