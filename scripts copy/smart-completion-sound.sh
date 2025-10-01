#!/bin/bash
# Smart completion sound that only plays when Claude is truly done and waiting for user input
# Only plays if all quality checks completed successfully without errors

# Function to check if there were recent errors in the last 10 seconds
check_recent_errors() {
    # Check for error patterns in recent hook outputs
    # Look for common error indicators that would have been output by previous hooks

    # Check if there's a recent self-review error marker
    if [ -f "/tmp/claude_self_review_errors.tmp" ]; then
        local file_age=$(($(date +%s) - $(stat -c %Y /tmp/claude_self_review_errors.tmp 2>/dev/null || echo 0)))
        if [ $file_age -lt 30 ]; then
            return 1
        fi
    fi

    # Check if there's a recent hook error marker
    if [ -f "/tmp/claude_hook_errors.tmp" ]; then
        local file_age=$(($(date +%s) - $(stat -c %Y /tmp/claude_hook_errors.tmp 2>/dev/null || echo 0)))
        if [ $file_age -lt 30 ]; then
            return 1
        fi
    fi

    # Check for TODO violations (if TODOs were found but not completed)
    if [ -f "/tmp/claude_todo_violations.tmp" ]; then
        local file_age=$(($(date +%s) - $(stat -c %Y /tmp/claude_todo_violations.tmp 2>/dev/null || echo 0)))
        if [ $file_age -lt 30 ]; then
            return 1
        fi
    fi

    return 0
}

# Check if any quality check hooks failed by looking for error markers
if ! check_recent_errors; then
    # Errors detected - don't play sound
    echo "⏸️  Quality checks had issues - notification suppressed"
    exit 0
fi

# Check if there are any active tasks or TODOs that need attention
if [ -f "/tmp/claude_active_tasks.tmp" ]; then
    # Tasks still in progress - don't play sound
    echo "⏳ Tasks still in progress - notification suppressed"
    exit 0
fi

# All checks passed - Claude is truly done and waiting for user input
echo "✅ All quality checks complete - Claude ready for input"

# Play completion sound (tries multiple sound systems for compatibility)
paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || \
    aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || \
    echo "\a" || \
    true