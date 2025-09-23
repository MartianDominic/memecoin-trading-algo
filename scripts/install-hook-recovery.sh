#!/bin/bash

# Hook Error Recovery Installation Script
# Integrates the hook error recovery tool with Claude Code and claude-flow

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
CONFIG_DIR="$PROJECT_ROOT/config"
LOGS_DIR="$PROJECT_ROOT/logs"

echo "🔧 Installing Hook Error Recovery Tool..."

# Create necessary directories
mkdir -p "$LOGS_DIR"
mkdir -p "$PROJECT_ROOT/.claude-flow/hooks"

# Make the recovery script executable
chmod +x "$SCRIPTS_DIR/hook-error-recovery.js"

# Create a wrapper script for easier access
cat > "$SCRIPTS_DIR/hook-recovery" << 'EOF'
#!/bin/bash
# Hook Recovery Wrapper Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/hook-error-recovery.js" "$@"
EOF

chmod +x "$SCRIPTS_DIR/hook-recovery"

# Create systemd service file for continuous monitoring (optional)
if command -v systemctl >/dev/null 2>&1; then
    cat > "/tmp/hook-recovery.service" << EOF
[Unit]
Description=Claude Code Hook Error Recovery
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_ROOT
ExecStart=$SCRIPTS_DIR/hook-recovery monitor
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    echo "📋 Systemd service file created at /tmp/hook-recovery.service"
    echo "   To install: sudo cp /tmp/hook-recovery.service /etc/systemd/system/"
    echo "   To enable: sudo systemctl enable hook-recovery.service"
    echo "   To start: sudo systemctl start hook-recovery.service"
fi

# Create a pre-commit hook to ensure recovery tool is running
cat > "$PROJECT_ROOT/.git/hooks/pre-commit" << 'EOF'
#!/bin/bash
# Check if hook recovery tool is available

SCRIPTS_DIR="$(git rev-parse --show-toplevel)/scripts"

if [ -f "$SCRIPTS_DIR/hook-recovery" ]; then
    # Start recovery tool in background if not running
    if ! pgrep -f "hook-error-recovery.js" > /dev/null; then
        echo "🔧 Starting hook error recovery tool..."
        nohup "$SCRIPTS_DIR/hook-recovery" monitor > /dev/null 2>&1 &
    fi
fi
EOF

chmod +x "$PROJECT_ROOT/.git/hooks/pre-commit"

# Integrate with claude-flow hooks
if [ -f "$PROJECT_ROOT/claude-flow.config.json" ]; then
    echo "🔗 Integrating with claude-flow configuration..."

    # Backup original config
    cp "$PROJECT_ROOT/claude-flow.config.json" "$PROJECT_ROOT/claude-flow.config.json.backup"

    # Add hook recovery integration
    cat > "$PROJECT_ROOT/.claude-flow/hooks/post-tool-use.js" << 'EOF'
#!/usr/bin/env node
// Auto-generated hook for error recovery integration

const HookErrorRecovery = require('../../scripts/hook-error-recovery.js');
const config = require('../../config/hook-recovery.config.json');

const recovery = new HookErrorRecovery(config);

// Monitor this hook execution for errors
process.on('uncaughtException', (error) => {
    recovery.log(`Hook execution error: ${error.message}`, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
    recovery.log(`Unhandled promise rejection: ${reason}`, 'error');
});

// Pass through the original hook data
console.log(JSON.stringify(process.argv.slice(2)));
EOF

    chmod +x "$PROJECT_ROOT/.claude-flow/hooks/post-tool-use.js"
fi

# Add NPM scripts for easy access
if [ -f "$PROJECT_ROOT/package.json" ]; then
    echo "📦 Adding NPM scripts..."

    # Add scripts using jq if available, otherwise manual instruction
    if command -v jq >/dev/null 2>&1; then
        jq '.scripts["hook:monitor"] = "node scripts/hook-error-recovery.js monitor"' "$PROJECT_ROOT/package.json" > tmp.json && mv tmp.json "$PROJECT_ROOT/package.json"
        jq '.scripts["hook:test"] = "node scripts/hook-error-recovery.js test"' "$PROJECT_ROOT/package.json" > tmp.json && mv tmp.json "$PROJECT_ROOT/package.json"
        jq '.scripts["hook:stats"] = "node scripts/hook-error-recovery.js stats"' "$PROJECT_ROOT/package.json" > tmp.json && mv tmp.json "$PROJECT_ROOT/package.json"
        jq '.scripts["hook:install"] = "./scripts/install-hook-recovery.sh"' "$PROJECT_ROOT/package.json" > tmp.json && mv tmp.json "$PROJECT_ROOT/package.json"
    else
        echo "ℹ️  Add these scripts to your package.json manually:"
        echo '  "hook:monitor": "node scripts/hook-error-recovery.js monitor"'
        echo '  "hook:test": "node scripts/hook-error-recovery.js test"'
        echo '  "hook:stats": "node scripts/hook-error-recovery.js stats"'
        echo '  "hook:install": "./scripts/install-hook-recovery.sh"'
    fi
fi

echo ""
echo "✅ Hook Error Recovery Tool installed successfully!"
echo ""
echo "🚀 Usage:"
echo "  Start monitoring:    npm run hook:monitor"
echo "  Or directly:         ./scripts/hook-recovery monitor"
echo "  Test recovery:       npm run hook:test"
echo "  View statistics:     npm run hook:stats"
echo ""
echo "🔧 Configuration:"
echo "  Edit: $CONFIG_DIR/hook-recovery.config.json"
echo "  Logs: $LOGS_DIR/"
echo ""
echo "💡 The tool will now automatically:"
echo "  - Monitor for hook errors in real-time"
echo "  - Detect incomplete tool_use/tool_result pairs"
echo "  - Automatically inject missing tool_result blocks"
echo "  - Log all recovery attempts"
echo "  - Integrate with claude-flow hooks"
echo ""
echo "🎯 Start monitoring now: npm run hook:monitor"