#!/bin/bash

# Integration Methodology Wrapper
# Universal wrapper that routes to appropriate validation scripts based on operation
# This ensures the Integration-First Methodology works everywhere
# Mode: ADVISORY (provides guidance but never blocks)

# DO NOT use set -e - this script must never fail or it corrupts Claude Code's message protocol
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Determine operation type
OPERATION="${OPERATION:-unknown}"
# Set FILE from environment or first positional parameter
FILE="${FILE:-$1}"
HOOK_PHASE="${HOOK_PHASE:-unknown}"

# Function to determine if file needs integration analysis
needs_integration_analysis() {
    local file="$1"

    # Check file patterns that need integration analysis
    if [[ "$file" =~ src/components/.*\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/lib/.*\.(ts|js)$ ]] || \
       [[ "$file" =~ src/services/.*\.(ts|js)$ ]] || \
       [[ "$file" =~ src/lib/services/.*\.(ts|js)$ ]] || \
       [[ "$file" =~ src/pages/.*\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/views/.*\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/features/.*\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/modules/.*\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/App\.(tsx|jsx|js|ts)$ ]] || \
       [[ "$file" =~ src/router.*\.(ts|js|tsx|jsx)$ ]] || \
       [[ "$file" =~ src/routes/.*\.(ts|js|tsx|jsx)$ ]] || \
       [[ "$file" =~ src/types/.*\.(ts|d\.ts)$ ]] || \
       [[ "$file" =~ src/interfaces/.*\.(ts|d\.ts)$ ]] || \
       [[ "$file" =~ src/models/.*\.(ts|js)$ ]] || \
       [[ "$file" =~ src/integrations/.*\.(ts|js)$ ]]; then
        return 0  # Needs analysis
    fi

    return 1  # Doesn't need analysis
}

# Function to check if this is a consolidation operation
is_consolidation_operation() {
    local file="$1"

    # Check for backup files indicating consolidation
    if [[ -f "${file}.backup" ]] || \
       [[ -f "${file}.original" ]] || \
       [[ -f "${file}.old" ]]; then
        return 0  # Is consolidation
    fi

    # Check for keywords in recent git commit messages
    local recent_commit=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    if [[ "$recent_commit" =~ consolidat|merge|unify|combine|integrate|refactor ]]; then
        return 0  # Likely consolidation
    fi

    return 1  # Not consolidation
}

# Function to run appropriate validation based on context
run_contextual_validation() {
    local file="$1"
    local phase="$2"

    # Check if file needs integration analysis FIRST (before any output)
    if ! needs_integration_analysis "$file"; then
        # Silent exit for non-architectural files
        exit 0
    fi

    # Only show header for consolidation operations or when issues detected
    # This keeps the output clean for regular development work

    # Determine which validation to run based on phase
    case "$phase" in
        "pre-edit"|"pre-tool")
            # Run the enforcer silently (advisory mode - analysis logged to /tmp)
            # Only show output for truly critical consolidation operations
            if [[ -x "./scripts/integration-analysis-enforcer.sh" ]]; then
                ./scripts/integration-analysis-enforcer.sh "$file" > /dev/null 2>&1 || true
            fi

            # If consolidation detected, run comprehensive discovery
            if is_consolidation_operation "$file"; then
                echo ""
                echo -e "${PURPLE}📊 CONSOLIDATION DETECTED - Running comprehensive analysis${NC}"
                if [[ -x "./docs/scripts/integration-discovery.sh" ]]; then
                    component_name=$(basename "$file" .tsx)
                    component_name=$(basename "$component_name" .ts)
                    ./docs/scripts/integration-discovery.sh "$component_name" || true
                fi
            fi
            ;;

        "post-edit"|"post-tool")
            # Run the preservation validator silently (advisory mode - analysis logged to /tmp)
            if [[ -x "./scripts/integration-preservation-validator.sh" ]]; then
                ./scripts/integration-preservation-validator.sh "$file" > /dev/null 2>&1 || true
            fi

            # If consolidation detected, run comprehensive checker
            if is_consolidation_operation "$file"; then
                echo ""
                echo -e "${PURPLE}📊 CONSOLIDATION DETECTED - Running comprehensive preservation check${NC}"
                if [[ -x "./docs/scripts/integration-preservation-checker.sh" ]]; then
                    ./docs/scripts/integration-preservation-checker.sh "$file" || true
                fi
            fi
            ;;

        "validate"|"check")
            echo -e "${YELLOW}🔍 Running comprehensive validation...${NC}"

            # Run full validation suite (advisory mode - never blocks)
            if [[ -x "./docs/scripts/integration-analysis-validator.sh" ]]; then
                ./docs/scripts/integration-analysis-validator.sh "$file" || true
            fi
            ;;

        *)
            echo -e "${YELLOW}⚠️  Unknown phase: $phase${NC}"
            echo "Running default analysis..."
            if [[ -x "./scripts/integration-analysis-enforcer.sh" ]]; then
                ./scripts/integration-analysis-enforcer.sh "$file" || true
            fi
            ;;
    esac

    # Only run health check for consolidation operations (reduces noise)
    if [[ "$phase" == "post-edit" ]] || [[ "$phase" == "post-tool" ]]; then
        if is_consolidation_operation "$file"; then
            check_post_consolidation_health "$file"
        fi
    fi
}

# Function to check post-consolidation health
check_post_consolidation_health() {
    local file="$1"
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    echo ""
    echo -e "${BLUE}🏥 POST-CONSOLIDATION HEALTH CHECK${NC}"

    # Check for similar components that might be duplicates
    local similar_files=$(find src/ -type f \( -name "*${component_name%View}*" -o -name "*${component_name%Manager}*" -o -name "*${component_name%Service}*" \) 2>/dev/null | grep -v "$file" | head -5)

    if [[ -n "$similar_files" ]]; then
        echo -e "${YELLOW}⚠️  Similar components detected (potential duplicates):${NC}"
        echo "$similar_files" | sed 's/^/  - /'
        echo ""
        echo -e "${BLUE}💡 TIP: If consolidation is complete, consider:${NC}"
        echo "  1. Removing backup files (*.backup, *.original)"
        echo "  2. Deleting orphaned duplicates after verification"
        echo "  3. Updating imports to use consolidated component"
    else
        echo -e "${GREEN}✅ No obvious duplicates found${NC}"
    fi

    # Check for backup files
    local backup_files=$(find "$(dirname "$file")" -name "$(basename "$file")*backup*" -o -name "$(basename "$file")*original*" 2>/dev/null)

    if [[ -n "$backup_files" ]]; then
        echo ""
        echo -e "${BLUE}📦 Backup files detected:${NC}"
        echo "$backup_files" | sed 's/^/  - /'
        echo -e "${BLUE}💡 TIP: Archive or remove after successful consolidation${NC}"
    fi

    # TypeScript health check disabled - handled by other hooks
    # The post-edit hooks already run comprehensive TypeScript checks
    echo ""
    echo -e "${BLUE}🔧 TypeScript health: Checked by post-edit hooks${NC}"
}

# Function to provide consolidation guidance
provide_consolidation_guidance() {
    echo ""
    echo -e "${PURPLE}📚 INTEGRATION-FIRST METHODOLOGY REFERENCE${NC}"
    echo ""
    echo -e "${BLUE}Complete methodology documentation:${NC}"
    echo "  📖 docs/INTEGRATION-FIRST-METHODOLOGY.md"
    echo ""
    echo -e "${BLUE}Validation tools:${NC}"
    echo "  🔍 Before changes: ./docs/scripts/integration-discovery.sh <component>"
    echo "  ✅ Validate plan: ./docs/scripts/integration-analysis-validator.sh <file>"
    echo "  🔧 After changes: ./docs/scripts/integration-preservation-checker.sh <file>"
    echo ""
    echo -e "${BLUE}Emergency procedures:${NC}"
    echo "  🚨 Rollback: mv <file>.backup <file> && npm run dev"
    echo "  📋 Check status: git status && npm run build"
    echo ""
    echo -e "${YELLOW}Remember the 5-step process:${NC}"
    echo "  1. 🎯 IDENTIFY PRIMARY - Determine ACTIVE implementation"
    echo "  2. 🔍 EXTRACT FEATURES - Inventory ALL functionality"
    echo "  3. 🔧 INTEGRATE - Enhance primary with features"
    echo "  4. ✅ VALIDATE - Test complete functionality"
    echo "  5. 🗑️ DELETE - Remove old ONLY after verification"
}

# Main execution
main() {
    # Ensure FILE is set from positional parameter if not already set
    if [[ -z "$FILE" ]] && [[ -n "$1" ]]; then
        FILE="$1"
    fi

    if [[ -z "$FILE" ]]; then
        echo -e "${RED}❌ ERROR: No file specified${NC}"
        echo "Usage: $0 <file_path>"
        echo ""
        provide_consolidation_guidance
        exit 1
    fi

    # Determine phase based on environment or arguments
    if [[ -n "$HOOK_PHASE" ]]; then
        phase="$HOOK_PHASE"
    elif [[ "$2" == "pre" ]] || [[ "$OPERATION" == "pre-edit" ]]; then
        phase="pre-edit"
    elif [[ "$2" == "post" ]] || [[ "$OPERATION" == "post-edit" ]]; then
        phase="post-edit"
    else
        phase="unknown"
    fi

    # Run contextual validation
    run_contextual_validation "$FILE" "$phase"

    # Only provide detailed guidance for consolidation operations
    # (keeps output clean for regular edits)
    if is_consolidation_operation "$FILE"; then
        provide_consolidation_guidance
    fi

    exit 0
}

# Run main function
main "$@"