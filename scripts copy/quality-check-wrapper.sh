#!/bin/bash
# Wrapper for quality check hooks that tracks errors
# Creates error marker if any check fails

HOOK_NAME="$1"
shift

# Clear previous error markers at the start of quality checks
if [ "$HOOK_NAME" == "check-todos" ]; then
    rm -f /tmp/claude_hook_errors.tmp
    rm -f /tmp/claude_active_tasks.tmp
fi

# Run the actual hook command
if claudekit-hooks run "$HOOK_NAME" "$@"; then
    # Hook succeeded
    exit 0
else
    # Hook failed - create error marker
    echo "Hook $HOOK_NAME failed at $(date)" >> /tmp/claude_hook_errors.tmp
    exit 1  # Propagate the error
fi