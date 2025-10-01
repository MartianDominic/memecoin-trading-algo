#!/bin/bash

# Verification script for Integration Analysis Framework installation

echo "🔍 Verifying Integration Analysis Framework Installation..."
echo ""

# Check settings.json
echo "📋 Checking settings.json..."
if [ -f ~/.claude/settings.json ]; then
    if grep -q "PreToolUse" ~/.claude/settings.json && grep -q "integration-analysis-enforcer" ~/.claude/settings.json; then
        echo "✅ settings.json installed correctly"
    else
        echo "❌ settings.json missing integration hooks"
        echo "   Fix: cp CLEAN-SETTINGS.json ~/.claude/settings.json"
    fi
else
    echo "❌ settings.json not found"
    echo "   Fix: cp CLEAN-SETTINGS.json ~/.claude/settings.json"
fi
echo ""

# Check hook scripts
echo "📋 Checking hook scripts..."
SCRIPTS=(
    "scripts/auto-fix-unicode.sh"
    "scripts/integration-analysis-enforcer.sh"
    "scripts/integration-preservation-validator.sh"
    "scripts/architectural-intent-analyzer.sh"
)

ALL_GOOD=true
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "✅ $script exists and is executable"
    else
        echo "❌ $script missing or not executable"
        ALL_GOOD=false
    fi
done
echo ""

# Check analysis directory
echo "📋 Checking analysis cache..."
if [ -d /tmp/claude_integration_analysis ]; then
    echo "✅ Analysis cache directory exists"
else
    echo "⚠️ Analysis cache will be created on first run"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ALL_GOOD" = true ] && [ -f ~/.claude/settings.json ] && grep -q "integration-analysis-enforcer" ~/.claude/settings.json 2>/dev/null; then
    echo "🎉 INSTALLATION SUCCESSFUL!"
    echo ""
    echo "The Integration Analysis Framework is ready to use."
    echo "It will automatically:"
    echo "  • Detect architectural change intentions"
    echo "  • Block unsafe modifications without analysis"
    echo "  • Validate integrations are preserved"
    echo "  • Display case study lessons"
else
    echo "⚠️ INSTALLATION INCOMPLETE"
    echo ""
    echo "Please fix the issues above, then run this script again."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"