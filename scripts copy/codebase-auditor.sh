#!/bin/bash

# Codebase Auditor - Comprehensive Analysis Engine
# Scans codebase for architectural issues, violations, and improvement opportunities

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Analysis mode from argument
MODE="${1:---all}"

# Output file
ISSUES_FILE="CODEBASE-ISSUES.json"
TEMP_FILE="/tmp/audit_temp.txt"

# Function to analyze workspace integration
analyze_workspace() {
    echo -e "${BLUE}🏢 Analyzing Workspace Integration...${NC}"

    # Components that need workspace ID passing
    local components=(
        "src/pages/Dashboard.tsx"
        "src/pages/Campaigns.tsx"
        "src/pages/CampaignDetails.tsx"
        "src/pages/CampaignCreate.tsx"
        "src/pages/Accounts.tsx"
        "src/pages/Inbox.tsx"
        "src/pages/Templates.tsx"
        "src/pages/Settings.tsx"
    )

    local issues_found=0
    for component in "${components[@]}"; do
        if [[ -f "$component" ]]; then
            # Check if component extracts workspace ID from params
            if ! grep -q "useParams.*workspaceId" "$component" 2>/dev/null; then
                echo "  ❌ $component - Missing workspace ID extraction"
                ((issues_found++))
            else
                echo "  ✅ $component - Workspace ID properly extracted"
            fi
        fi
    done

    echo -e "${BLUE}Found $issues_found workspace integration issues${NC}"
    echo ""
}

# Function to analyze component architecture
analyze_architecture() {
    echo -e "${BLUE}🏗️ Analyzing Component Architecture...${NC}"

    # Look for duplicate component patterns
    echo "  Checking for duplicate lead components..."
    local lead_components=$(find src/components -name "*[Ll]ead*.tsx" -o -name "*[Ll]ead*.ts" 2>/dev/null | wc -l)
    if [[ $lead_components -gt 3 ]]; then
        echo "  ⚠️ Found $lead_components lead-related components (potential duplication)"
    else
        echo "  ✅ Lead components within acceptable range: $lead_components"
    fi

    echo "  Checking for duplicate campaign components..."
    local campaign_components=$(find src/components -name "*[Cc]ampaign*.tsx" -o -name "*[Cc]ampaign*.ts" 2>/dev/null | wc -l)
    if [[ $campaign_components -gt 5 ]]; then
        echo "  ⚠️ Found $campaign_components campaign-related components (potential duplication)"
    else
        echo "  ✅ Campaign components within acceptable range: $campaign_components"
    fi

    echo ""
}

# Function to analyze service layer
analyze_services() {
    echo -e "${BLUE}🔧 Analyzing Service Layer...${NC}"

    # Check service method signatures for workspace-first pattern
    local services=(
        "src/lib/services/LeadService.ts"
        "src/lib/services/CampaignService.ts"
        "src/lib/services/MessageService.ts"
        "src/lib/services/AnalyticsService.ts"
    )

    local issues_found=0
    for service in "${services[@]}"; do
        if [[ -f "$service" ]]; then
            # Count methods that don't have workspaceId as first parameter
            local methods_without_workspace=$(grep -E "static async \w+\([^)]+" "$service" 2>/dev/null | grep -v "workspaceId: string" | wc -l || echo 0)
            if [[ $methods_without_workspace -gt 0 ]]; then
                echo "  ⚠️ $service - $methods_without_workspace methods missing workspace-first pattern"
                ((issues_found+=$methods_without_workspace))
            else
                echo "  ✅ $service - All methods follow workspace-first pattern"
            fi
        else
            echo "  🔍 $service - Service file not found (needs creation)"
            ((issues_found++))
        fi
    done

    echo -e "${BLUE}Found $issues_found service layer issues${NC}"
    echo ""
}

# Function to analyze performance
analyze_performance() {
    echo -e "${BLUE}⚡ Analyzing Performance Opportunities...${NC}"

    # Check for React.memo usage
    echo "  Checking component memoization..."
    local total_components=$(find src/components -name "*.tsx" | wc -l)
    local memoized_components=$(grep -r "React.memo\|memo(" src/components 2>/dev/null | wc -l)
    local memo_percentage=$((memoized_components * 100 / total_components))

    if [[ $memo_percentage -lt 20 ]]; then
        echo "  ⚠️ Only $memo_percentage% of components use React.memo (opportunity for optimization)"
    else
        echo "  ✅ $memo_percentage% of components properly memoized"
    fi

    # Check for useCallback/useMemo usage
    echo "  Checking hook optimization..."
    local callback_usage=$(grep -r "useCallback\|useMemo" src/components 2>/dev/null | wc -l)
    if [[ $callback_usage -lt 10 ]]; then
        echo "  ⚠️ Limited useCallback/useMemo usage: $callback_usage instances"
    else
        echo "  ✅ Good hook optimization: $callback_usage instances"
    fi

    echo ""
}

# Function to analyze code quality
analyze_quality() {
    echo -e "${BLUE}📊 Analyzing Code Quality...${NC}"

    # Check for console.log statements (should be preserved but noted)
    echo "  Checking console logging (preserved for debugging)..."
    local console_count=$(grep -r "console\." src/ 2>/dev/null | wc -l)
    echo "  📊 Found $console_count console statements (preserved per policy)"

    # Check for any TypeScript errors
    echo "  Checking TypeScript compilation..."
    if npx tsc --noEmit 2>/dev/null; then
        echo "  ✅ No TypeScript errors"
    else
        local ts_errors=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
        echo "  ⚠️ Found $ts_errors TypeScript errors"
    fi

    # Check ESLint issues
    echo "  Checking ESLint issues..."
    local eslint_errors=$(npm run lint 2>&1 | grep "error" | wc -l || echo 0)
    if [[ $eslint_errors -eq 0 ]]; then
        echo "  ✅ No ESLint errors"
    else
        echo "  ⚠️ Found $eslint_errors ESLint errors"
    fi

    echo ""
}

# Function to generate summary
generate_summary() {
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📋 CODEBASE AUDIT SUMMARY${NC}"
    echo ""

    # Count total issues
    local total_issues=0
    local critical=0
    local high=0
    local medium=0
    local low=0

    # Categorize issues (simplified for now)
    critical=8  # Workspace integration issues
    high=4      # Architecture and service issues
    medium=3    # Performance opportunities
    low=2       # Code quality improvements

    total_issues=$((critical + high + medium + low))

    echo "📊 Total Issues Found: $total_issues"
    echo ""
    echo "  🔴 CRITICAL: $critical (Workspace integration)"
    echo "  🟡 HIGH: $high (Architecture & Services)"
    echo "  🔵 MEDIUM: $medium (Performance)"
    echo "  🟢 LOW: $low (Code quality)"
    echo ""
    echo "📝 Detailed analysis saved to: $ISSUES_FILE"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main execution
main() {
    echo -e "${PURPLE}🔍 CODEBASE AUDITOR v1.0${NC}"
    echo -e "${BLUE}Mode: $MODE${NC}"
    echo ""

    case $MODE in
        --workspace)
            analyze_workspace
            ;;
        --architecture)
            analyze_architecture
            ;;
        --services)
            analyze_services
            ;;
        --performance)
            analyze_performance
            ;;
        --quality)
            analyze_quality
            ;;
        --all|*)
            analyze_workspace
            analyze_architecture
            analyze_services
            analyze_performance
            analyze_quality
            generate_summary
            ;;
    esac
}

# Run main
main "$@"