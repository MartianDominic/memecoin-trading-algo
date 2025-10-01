#!/bin/bash

# Architectural Intent Analyzer Hook
# Analyzes user prompts to detect potential architectural changes and triggers appropriate analysis

# DO NOT use set -e - this script must never fail or it corrupts Claude Code's message protocol
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Get user prompt from environment or stdin
USER_PROMPT="${USER_PROMPT:-$(cat 2>/dev/null || echo '')}"

# Keywords that indicate architectural changes
COMPONENT_KEYWORDS=(
    "create component"
    "new component"
    "build component"
    "redesign"
    "replace.*component"
    "delete component"
    "remove component"
    "refactor component"
    "rebuild.*ui"
    "new.*page"
    "create.*page"
)

SERVICE_KEYWORDS=(
    "create service"
    "new service"
    "build service"
    "replace.*service"
    "delete service"
    "remove service"
    "refactor service"
    "service layer"
    "api.*change"
)

ARCHITECTURAL_KEYWORDS=(
    "architecture"
    "refactor"
    "redesign"
    "replace"
    "rebuild"
    "restructure"
    "consolidate"
    "merge.*component"
    "split.*component"
    "duplicate"
)

DANGER_KEYWORDS=(
    "delete.*component"
    "remove.*component"
    "replace.*with"
    "start.*from.*scratch"
    "rebuild.*everything"
    "clean.*up"
    "consolidate"
)

# Function to check if prompt contains keywords
contains_keywords() {
    local text="$1"
    local -n keywords=$2

    for keyword in "${keywords[@]}"; do
        if echo "$text" | grep -iE "$keyword" >/dev/null 2>&1; then
            return 0  # Found keyword
        fi
    done
    return 1  # No keywords found
}

# Function to extract potential component/service names
extract_component_names() {
    local text="$1"

    # Look for component names (PascalCase words ending in common component suffixes)
    echo "$text" | grep -oE '[A-Z][a-zA-Z]*(Component|View|Manager|Service|Page|Provider|Context|Hook)' | sort -u
}

# Function to detect modification intent
detect_modification_intent() {
    local text="$1"

    if echo "$text" | grep -iE "(redesign|improve|enhance|add.*feature)" >/dev/null; then
        echo "ENHANCEMENT"
    elif echo "$text" | grep -iE "(replace.*with|rebuild|start.*from.*scratch)" >/dev/null; then
        echo "REPLACEMENT"
    elif echo "$text" | grep -iE "(delete|remove|clean.*up)" >/dev/null; then
        echo "DELETION"
    elif echo "$text" | grep -iE "(create|new|build)" >/dev/null; then
        echo "CREATION"
    elif echo "$text" | grep -iE "(refactor|restructure|consolidate)" >/dev/null; then
        echo "REFACTORING"
    else
        echo "UNCLEAR"
    fi
}

# Function to assess risk level
assess_risk_level() {
    local text="$1"
    local intent="$2"

    if contains_keywords "$text" DANGER_KEYWORDS; then
        echo "CRITICAL"
    elif [[ "$intent" == "REPLACEMENT" ]] || [[ "$intent" == "DELETION" ]]; then
        echo "HIGH"
    elif contains_keywords "$text" ARCHITECTURAL_KEYWORDS; then
        echo "MEDIUM"
    elif [[ "$intent" == "CREATION" ]] || [[ "$intent" == "ENHANCEMENT" ]]; then
        echo "LOW"
    else
        echo "UNKNOWN"
    fi
}

# Function to provide architectural guidance
provide_architectural_guidance() {
    local intent="$1"
    local risk_level="$2"
    local components="$3"

    echo -e "${PURPLE}🏗️ ARCHITECTURAL CHANGE DETECTED${NC}"
    echo -e "${BLUE}Intent: $intent${NC}"
    echo -e "${BLUE}Risk Level: $risk_level${NC}"

    if [[ -n "$components" ]]; then
        echo -e "${BLUE}Components Mentioned: $components${NC}"
    fi
    echo ""

    case $intent in
        "ENHANCEMENT")
            echo -e "${GREEN}✅ SAFE INTENT DETECTED${NC}"
            echo -e "${BLUE}Recommended Strategy: PRESERVE_AND_ENHANCE${NC}"
            echo "• Analyze existing components first"
            echo "• Preserve all existing functionality"
            echo "• Add new features incrementally"
            echo "• Test all integrations"
            ;;
        "REPLACEMENT")
            echo -e "${RED}🚨 HIGH RISK INTENT DETECTED${NC}"
            echo -e "${YELLOW}Recommended Strategy: PLANNED_MIGRATION${NC}"
            echo "• ⚠️ STOP: Run integration analysis first"
            echo "• ⚠️ Understand what exists before replacing"
            echo "• ⚠️ Create migration plan with user approval"
            echo "• ⚠️ Build replacement in parallel"
            echo "• ⚠️ Test thoroughly before switching"
            ;;
        "DELETION")
            echo -e "${RED}⛔ CRITICAL RISK INTENT DETECTED${NC}"
            echo -e "${RED}Required Strategy: FEATURE_EXTRACTION_FIRST${NC}"
            echo "• 🛑 MANDATORY: Analyze what will be lost"
            echo "• 🛑 MANDATORY: Extract valuable features first"
            echo "• 🛑 MANDATORY: Get user confirmation of feature loss"
            echo "• 🛑 MANDATORY: Create rollback plan"
            echo ""
            echo -e "${YELLOW}⚠️ CRITICAL LESSON: LeadManager Case Study${NC}"
            echo "Nearly deleted 955 lines of advanced features from ORPHANED component"
            echo "without realizing ResponsiveUnifiedLeadsView was the ACTIVE component."
            echo "ALWAYS run integration analysis before ANY deletion!"
            ;;
        "CREATION")
            echo -e "${YELLOW}⚠️ DUPLICATION RISK DETECTED${NC}"
            echo -e "${BLUE}Recommended Strategy: ANALYZE_EXISTING_FIRST${NC}"
            echo "• Search for existing similar functionality"
            echo "• Check for orphaned components with desired features"
            echo "• Consider enhancing existing vs creating new"
            echo "• Follow single-responsibility principle"
            echo ""
            echo -e "${YELLOW}⚠️ ANTI-PATTERN WARNING: Component Duplication${NC}"
            echo "Creating duplicate components leads to 3x maintenance burden,"
            echo "feature fragmentation, and architectural debt accumulation."
            echo "ALWAYS enhance existing components instead of creating duplicates!"
            ;;
        "REFACTORING")
            echo -e "${YELLOW}⚠️ INTEGRATION RISK DETECTED${NC}"
            echo -e "${BLUE}Recommended Strategy: PRESERVE_INTEGRATIONS${NC}"
            echo "• Map all existing integrations first"
            echo "• Preserve external interfaces"
            echo "• Refactor internals while maintaining APIs"
            echo "• Test all dependent components"
            ;;
        *)
            echo -e "${YELLOW}❓ UNCLEAR INTENT${NC}"
            echo -e "${BLUE}Recommended Strategy: CLARIFY_REQUIREMENTS${NC}"
            echo "• Ask user to clarify specific intent"
            echo "• Understand what should be preserved vs changed"
            echo "• Define success criteria before starting"
            ;;
    esac

    echo ""
    echo -e "${BLUE}📚 Required Reading:${NC}"
    echo "• INTEGRATION-ANALYSIS-FRAMEWORK.md"
    echo "• INTEGRATION-ANALYSIS-CASE-STUDIES.md"
    echo "• ARCHITECTURE-debt-plan-to-fix.MD"
    echo "• CLAUDE.md (Architectural Governance section)"
    echo ""
}

# Function to create analysis reminder
create_analysis_reminder() {
    local intent="$1"
    local risk_level="$2"
    local components="$3"

    local reminder_file="/tmp/claude_architectural_reminder.md"

    cat > "$reminder_file" << EOF
# 🚨 ARCHITECTURAL CHANGE REMINDER

**User Intent**: $intent
**Risk Level**: $risk_level
**Components Mentioned**: $components
**Analysis Date**: $(date)

## MANDATORY STEPS BEFORE PROCEEDING:

### 1. Integration Analysis Required
- [ ] Run integration analysis for all mentioned components
- [ ] Understand current usage and dependencies
- [ ] Classify component status (ACTIVE/ORPHANED/SHARED/etc.)

### 2. Strategy Selection Required
- [ ] Based on analysis, select appropriate strategy
- [ ] Get user confirmation if strategy differs from request
- [ ] Create implementation plan with backup strategy

### 3. Risk Mitigation Required
- [ ] Create backup copies of all components to be modified
- [ ] Document rollback procedure
- [ ] Plan testing strategy for validating changes

## AUTOMATED ENFORCEMENT:
The integration-analysis-enforcer hook will automatically run before any component/service modifications to ensure this analysis is completed.

## WARNING:
Do not proceed with component/service modifications without completing this analysis. The hook system will block unsafe changes.
EOF

    echo -e "${GREEN}📝 Analysis reminder created: $reminder_file${NC}"
}

# Main execution
main() {
    if [[ -z "$USER_PROMPT" ]]; then
        # Silent exit if no prompt (not an error condition)
        exit 0
    fi

    # Convert to lowercase for analysis
    local prompt_lower=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

    # Check if this is an architectural change request
    local is_architectural=false

    if contains_keywords "$prompt_lower" COMPONENT_KEYWORDS || \
       contains_keywords "$prompt_lower" SERVICE_KEYWORDS || \
       contains_keywords "$prompt_lower" ARCHITECTURAL_KEYWORDS; then
        is_architectural=true
    fi

    if [[ "$is_architectural" == "false" ]]; then
        # Not an architectural change, exit silently
        exit 0
    fi

    # Analyze the architectural intent
    local intent=$(detect_modification_intent "$prompt_lower")
    local risk_level=$(assess_risk_level "$prompt_lower" "$intent")
    local components=$(extract_component_names "$USER_PROMPT")

    # Provide guidance
    provide_architectural_guidance "$intent" "$risk_level" "$components"

    # Create reminder for complex changes
    if [[ "$risk_level" != "LOW" ]]; then
        create_analysis_reminder "$intent" "$risk_level" "$components"
    fi

    # Log the analysis
    local audit_file="/tmp/claude_integration_analysis/audit.log"
    mkdir -p "$(dirname "$audit_file")"
    echo "$(date -Iseconds) | PROMPT_ANALYSIS | $intent | $risk_level | $components | $(echo "$USER_PROMPT" | head -c 100)..." >> "$audit_file"

    exit 0
}

# Run main function
main "$@"