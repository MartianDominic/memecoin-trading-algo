#!/bin/bash

# Integration Analysis Enforcer Hook - ADVISORY MODE
# Automatically enforces integration analysis framework before architectural changes
# This hook runs in ADVISORY mode and never blocks (always exits 0)

# DO NOT use set -e - this script must never fail or it corrupts Claude Code's message protocol
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Analysis cache directory
ANALYSIS_CACHE="/tmp/claude_integration_analysis"
mkdir -p "$ANALYSIS_CACHE"

# Bypass flag (use with caution!)
BYPASS_INTEGRATION_ANALYSIS="${BYPASS_INTEGRATION_ANALYSIS:-false}"

# Function to detect architectural changes
detect_architectural_change() {
    local file="$1"
    local change_type=""

    # Detect component changes
    if [[ "$file" =~ src/components/.*\.tsx$ ]]; then
        change_type="COMPONENT"
    # Detect service changes
    elif [[ "$file" =~ src/lib/.*Service\.ts$ ]] || [[ "$file" =~ src/lib/services/.*\.ts$ ]]; then
        change_type="SERVICE"
    # Detect page changes
    elif [[ "$file" =~ src/pages/.*\.tsx$ ]]; then
        change_type="PAGE"
    # Detect routing changes
    elif [[ "$file" =~ src/App\.tsx$ ]] || [[ "$file" =~ src/router.*\.ts$ ]]; then
        change_type="ROUTING"
    # Detect type changes
    elif [[ "$file" =~ src/types/.*\.ts$ ]] || [[ "$file" =~ src/integrations/.*types.*\.ts$ ]]; then
        change_type="TYPES"
    fi

    echo "$change_type"
}

# Function to check if file is being created (new component/service)
is_new_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        return 0  # Is new file
    else
        return 1  # Existing file
    fi
}

# Function to check if integration analysis exists for a component/service
has_integration_analysis() {
    local file="$1"
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    local analysis_file="$ANALYSIS_CACHE/${component_name}_analysis.json"

    if [[ -f "$analysis_file" ]]; then
        # Check if analysis is recent (within 24 hours)
        local analysis_age=$(($(date +%s) - $(stat -c %Y "$analysis_file" 2>/dev/null || echo 0)))
        if [[ $analysis_age -lt 86400 ]]; then
            return 0  # Has recent analysis
        fi
    fi

    return 1  # No analysis or stale analysis
}

# Function to run integration discovery
run_integration_discovery() {
    local file="$1"
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    echo -e "${BLUE}🔍 Running integration discovery for: $component_name${NC}"

    local analysis_file="$ANALYSIS_CACHE/${component_name}_analysis.json"
    local report_file="$ANALYSIS_CACHE/${component_name}_report.md"

    # Create analysis report
    cat > "$report_file" << EOF
# Integration Analysis Report: $component_name

**File**: $file
**Analysis Date**: $(date)
**Analyzer**: Claude Integration Enforcer

## Direct Usage Analysis
EOF

    echo "### Import Analysis" >> "$report_file"
    if grep -r "import.*$component_name" src/ 2>/dev/null; then
        echo "**Status**: 🟢 ACTIVELY IMPORTED" >> "$report_file"
        grep -r "import.*$component_name" src/ | sed 's/^/- /' >> "$report_file"
    elif grep -r "from.*$component_name" src/ 2>/dev/null; then
        echo "**Status**: 🟢 ACTIVELY IMPORTED" >> "$report_file"
        grep -r "from.*$component_name" src/ | sed 's/^/- /' >> "$report_file"
    else
        echo "**Status**: ❌ NOT IMPORTED (POTENTIAL ORPHAN)" >> "$report_file"
    fi

    echo "" >> "$report_file"
    echo "### JSX Usage Analysis" >> "$report_file"
    if grep -r "<$component_name" src/ 2>/dev/null; then
        echo "**Status**: 🟢 ACTIVELY USED IN JSX" >> "$report_file"
        grep -r "<$component_name" src/ | sed 's/^/- /' >> "$report_file"
    else
        echo "**Status**: ❌ NOT USED IN JSX" >> "$report_file"
    fi

    echo "" >> "$report_file"
    echo "### Routing Analysis" >> "$report_file"
    if grep -r "$component_name" src/App.tsx src/router/ src/routes/ 2>/dev/null; then
        echo "**Status**: 🟢 INTEGRATED WITH ROUTING" >> "$report_file"
        grep -r "$component_name" src/App.tsx src/router/ src/routes/ 2>/dev/null | sed 's/^/- /' >> "$report_file"
    else
        echo "**Status**: ⚠️ NO ROUTING INTEGRATION" >> "$report_file"
    fi

    # Analyze dependencies if file exists
    if [[ -f "$file" ]]; then
        echo "" >> "$report_file"
        echo "### Component Dependencies" >> "$report_file"
        echo "**Imports**:" >> "$report_file"
        head -30 "$file" | grep "import" | sed 's/^/- /' >> "$report_file"

        echo "" >> "$report_file"
        echo "### Service Usage" >> "$report_file"
        if grep -n "ServiceOrchestrator\|Service" "$file" 2>/dev/null; then
            echo "**Services Used**:" >> "$report_file"
            grep -n "ServiceOrchestrator\|Service" "$file" | sed 's/^/- Line /' >> "$report_file"
        else
            echo "**Services Used**: None detected" >> "$report_file"
        fi
    fi

    # Determine component status
    local status="UNKNOWN"
    if grep -r "import.*$component_name\|from.*$component_name" src/ >/dev/null 2>&1; then
        if grep -r "<$component_name" src/ >/dev/null 2>&1; then
            status="ACTIVE"
        else
            status="IMPORTED_BUT_UNUSED"
        fi
    elif grep -r "$component_name" src/App.tsx src/router/ src/routes/ >/dev/null 2>&1; then
        status="ROUTING_INTEGRATED"
    else
        status="ORPHANED"
    fi

    # Create JSON analysis data
    cat > "$analysis_file" << EOF
{
  "component": "$component_name",
  "file": "$file",
  "analysis_date": "$(date -Iseconds)",
  "status": "$status",
  "has_imports": $(grep -r "import.*$component_name\|from.*$component_name" src/ >/dev/null 2>&1 && echo "true" || echo "false"),
  "has_jsx_usage": $(grep -r "<$component_name" src/ >/dev/null 2>&1 && echo "true" || echo "false"),
  "has_routing": $(grep -r "$component_name" src/App.tsx src/router/ src/routes/ >/dev/null 2>&1 && echo "true" || echo "false"),
  "risk_level": "$(case $status in ACTIVE|ROUTING_INTEGRATED) echo "HIGH";; IMPORTED_BUT_UNUSED) echo "MEDIUM";; ORPHANED) echo "LOW";; *) echo "UNKNOWN";; esac)"
}
EOF

    echo -e "${GREEN}✅ Integration analysis completed for $component_name${NC}"
    echo -e "${BLUE}📊 Status: $status${NC}"
    echo -e "${BLUE}📁 Report: $report_file${NC}"

    return 0
}

# Function to display analysis results and get approval
display_analysis_and_get_approval() {
    local file="$1"
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    local analysis_file="$ANALYSIS_CACHE/${component_name}_analysis.json"
    local report_file="$ANALYSIS_CACHE/${component_name}_report.md"

    if [[ -f "$analysis_file" ]]; then
        local status=$(grep -o '"status": "[^"]*"' "$analysis_file" | cut -d'"' -f4)
        local risk_level=$(grep -o '"risk_level": "[^"]*"' "$analysis_file" | cut -d'"' -f4)

        echo -e "${PURPLE}📋 INTEGRATION ANALYSIS RESULTS${NC}"
        echo -e "${BLUE}Component: $component_name${NC}"
        echo -e "${BLUE}Status: $status${NC}"
        echo -e "${BLUE}Risk Level: $risk_level${NC}"
        echo ""

        case $status in
            "ACTIVE")
                echo -e "${RED}🚨 CRITICAL: This is an ACTIVE component in production!${NC}"
                echo -e "${RED}Modifying this component affects live users and integrations.${NC}"
                echo ""
                echo -e "${YELLOW}MANDATORY Strategy: PRESERVE_AND_ENHANCE${NC}"
                echo -e "${BLUE}Required Actions:${NC}"
                echo "1. Create backup: cp $file ${file}.backup"
                echo "2. Preserve ALL existing functionality"
                echo "3. Add new features incrementally"
                echo "4. Test all existing integrations"
                echo "5. Verify no regressions"
                echo ""
                echo -e "${RED}⚠️ DO NOT:${NC}"
                echo "- Rewrite from scratch"
                echo "- Remove existing features"
                echo "- Change component APIs"
                echo "- Break existing integrations"
                echo ""
                echo -e "${PURPLE}📋 PRESERVE_AND_ENHANCE Strategy Required${NC}"
                echo -e "${BLUE}Claude: You MUST follow this strategy for ACTIVE components${NC}"
                echo ""
                ;;
            "ROUTING_INTEGRATED")
                echo -e "${RED}🚨 CRITICAL: This component is integrated with routing!${NC}"
                echo -e "${RED}Changes may break navigation and user workflows.${NC}"
                echo ""
                echo -e "${YELLOW}MANDATORY: Preserve routing integration${NC}"
                echo -e "${BLUE}Required Actions:${NC}"
                echo "1. Test all route transitions"
                echo "2. Preserve workspace-scoped routing"
                echo "3. Validate redirect behavior"
                echo ""
                ;;
            "IMPORTED_BUT_UNUSED")
                echo -e "${YELLOW}⚠️ CAUTION: Component is imported but not used in JSX${NC}"
                echo -e "${YELLOW}May be used programmatically or be partially integrated.${NC}"
                echo -e "${YELLOW}Proceed carefully and test all import locations.${NC}"
                echo ""
                ;;
            "ORPHANED")
                echo -e "${GREEN}✅ SAFE: Component appears to be orphaned${NC}"
                echo -e "${GREEN}Can be safely modified or used for feature extraction.${NC}"
                echo ""
                ;;
            *)
                echo -e "${RED}❓ UNKNOWN: Component status unclear${NC}"
                echo -e "${RED}🚨 BLOCKED: Requires manual analysis before proceeding${NC}"
                echo ""
                return 1
                ;;
        esac

        echo ""
        echo -e "${BLUE}📄 Full analysis report available at: $report_file${NC}"

        return 0
    else
        echo -e "${RED}❌ ERROR: Analysis file not found${NC}"
        return 1
    fi
}

# Function to check for risky architectural patterns
check_risky_patterns() {
    local file="$1"
    local is_new_file="$2"

    # Check if this creates potential duplicates
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    echo -e "${BLUE}🔍 Checking for risky architectural patterns...${NC}"

    local has_duplicates=false

    # Check for similar named components (more aggressive detection)
    local base_name="${component_name%Manager*}"
    base_name="${base_name%View*}"
    base_name="${base_name%Service*}"
    base_name="${base_name%[0-9]*}"  # Remove trailing numbers like Manager2, Manager3

    local similar_components=$(find src/ -type f \( -name "*${base_name}Manager*" -o -name "*${base_name}View*" -o -name "*${base_name}Service*" -o -name "*${base_name}*" \) 2>/dev/null | grep -v "node_modules" || true)

    if [[ -n "$similar_components" ]] && [[ $(echo "$similar_components" | wc -l) -gt 0 ]]; then
        echo -e "${RED}🚨 BLOCKING: Similar components detected!${NC}"
        echo "$similar_components" | sed 's/^/  - /'
        echo ""
        echo -e "${RED}Risk: Creating duplicate functionality${NC}"
        echo -e "${RED}Required Action: Analyze existing components before creating new ones${NC}"
        echo -e "${YELLOW}Recommendation: EXTEND existing component instead of creating duplicate${NC}"
        echo ""

        if [[ "$is_new_file" == "true" ]]; then
            has_duplicates=true
        fi
    fi

    # Check for service duplication patterns
    if [[ "$file" =~ Service\.ts$ ]]; then
        local service_name=$(basename "$file" .ts)
        local similar_services=$(find src/ -name "*Service*.ts" | grep -i "${service_name%Service}" 2>/dev/null || true)

        if [[ -n "$similar_services" ]] && [[ $(echo "$similar_services" | wc -l) -gt 1 ]]; then
            echo -e "${RED}🚨 BLOCKING: Similar services detected!${NC}"
            echo "$similar_services" | sed 's/^/  - /'
            echo ""
            echo -e "${RED}Risk: Service layer duplication${NC}"
            echo -e "${RED}Required Action: Check ServiceOrchestrator and existing services${NC}"
            echo -e "${YELLOW}Recommendation: Add method to existing service instead of creating new service${NC}"
            echo ""

            if [[ "$is_new_file" == "true" ]]; then
                has_duplicates=true
            fi
        fi
    fi

    # Return status
    if [[ "$has_duplicates" == "true" ]]; then
        return 1  # Has duplicates - should block
    else
        return 0  # No duplicates or existing file modification
    fi
}

# Function to enforce architectural guidelines
enforce_architectural_guidelines() {
    local file="$1"
    local change_type="$2"

    echo -e "${PURPLE}🏗️ ARCHITECTURAL GUIDELINES ENFORCEMENT${NC}"
    echo ""

    case $change_type in
        "COMPONENT")
            echo -e "${BLUE}📋 Component Modification Guidelines:${NC}"
            echo "1. ✅ Integration analysis completed"
            echo "2. ⚠️ If ACTIVE: Use PRESERVE_AND_ENHANCE strategy"
            echo "3. ⚠️ If ORPHANED: Extract features before deletion"
            echo "4. ⚠️ If creating new: Check for existing similar functionality"
            echo "5. 🔒 Always backup before modification"
            ;;
        "SERVICE")
            echo -e "${BLUE}📋 Service Modification Guidelines:${NC}"
            echo "1. ✅ Integration analysis completed"
            echo "2. ⚠️ Check for duplicate service functionality"
            echo "3. ⚠️ Ensure workspace parameter consistency"
            echo "4. ⚠️ Preserve all existing method signatures"
            echo "5. 🔒 Test all dependent components"
            ;;
        "PAGE")
            echo -e "${BLUE}📋 Page Modification Guidelines:${NC}"
            echo "1. ✅ Integration analysis completed"
            echo "2. ⚠️ Check routing integration"
            echo "3. ⚠️ Preserve user workflows"
            echo "4. ⚠️ Test navigation patterns"
            echo "5. 🔒 Validate workspace context"
            ;;
        "ROUTING")
            echo -e "${RED}🚨 ROUTING MODIFICATION - HIGH RISK${NC}"
            echo "1. ⚠️ This affects navigation for all users"
            echo "2. ⚠️ Test all route transitions"
            echo "3. ⚠️ Preserve workspace-scoped routing"
            echo "4. 🔒 Validate redirect behavior"
            echo "5. 🔒 Test with different user scenarios"
            ;;
        "TYPES")
            echo -e "${YELLOW}⚠️ TYPE MODIFICATION - MEDIUM RISK${NC}"
            echo "1. ✅ Integration analysis completed"
            echo "2. ⚠️ Check for type usage across codebase"
            echo "3. ⚠️ Ensure backward compatibility"
            echo "4. ⚠️ Validate database schema alignment"
            echo "5. 🔒 Run comprehensive type checking"
            ;;
    esac

    echo ""
    echo -e "${BLUE}📚 Reference Documents:${NC}"
    echo "- docs/INTEGRATION-FIRST-METHODOLOGY.md (COMPLETE METHODOLOGY)"
    echo "- INTEGRATION-ANALYSIS-FRAMEWORK.md"
    echo "- ARCHITECTURE-debt-plan-to-fix.MD"
    echo "- CLAUDE.md (Architectural Governance section)"
    echo ""
    echo -e "${BLUE}🔧 Enhanced Validation Tools:${NC}"
    echo "- docs/scripts/integration-analysis-validator.sh (Comprehensive validation)"
    echo "- docs/scripts/integration-discovery.sh (Complete integration analysis)"
    echo "- docs/scripts/integration-preservation-checker.sh (Post-change validation)"
    echo ""
}

# Main execution
main() {
    local file="${FILE:-$1}"
    local operation="${OPERATION:-modify}"

    if [[ -z "$file" ]]; then
        echo -e "${RED}❌ ERROR: No file specified${NC}"
        echo "Usage: $0 <file_path>"
        exit 1
    fi

    echo -e "${PURPLE}🔒 INTEGRATION ANALYSIS ENFORCER${NC}"
    echo -e "${BLUE}File: $file${NC}"
    echo -e "${BLUE}Operation: $operation${NC}"
    echo ""

    # Detect if this is an architectural change
    local change_type=$(detect_architectural_change "$file")

    if [[ -z "$change_type" ]]; then
        echo -e "${GREEN}✅ No architectural analysis required for this file${NC}"
        exit 0
    fi

    echo -e "${YELLOW}🏗️ Architectural change detected: $change_type${NC}"
    echo ""

    # Check for bypass flag
    if [[ "$BYPASS_INTEGRATION_ANALYSIS" == "true" ]]; then
        echo -e "${RED}⚠️ BYPASS FLAG DETECTED - Skipping integration analysis${NC}"
        echo -e "${RED}This is DANGEROUS and may lead to architectural debt${NC}"
        echo ""
        exit 0
    fi

    # Check for risky patterns BEFORE analysis (blocks new duplicate files)
    local is_new_file_flag="false"
    if is_new_file "$file"; then
        is_new_file_flag="true"
        echo -e "${YELLOW}📝 New file creation detected${NC}"
        echo ""
    fi

    if ! check_risky_patterns "$file" "$is_new_file_flag"; then
        echo -e "${RED}❌ BLOCKED: Duplicate functionality detected!${NC}"
        echo ""
        echo -e "${RED}🚨 ARCHITECTURAL GOVERNANCE VIOLATION${NC}"
        echo "Creating new components/services that duplicate existing functionality"
        echo "is PROHIBITED by CLAUDE.md architectural governance."
        echo ""
        echo -e "${BLUE}Required Actions:${NC}"
        echo "1. Search for existing functionality: grep -r \"<similar_name>\" src/"
        echo "2. Check Component/Service Registry in CLAUDE.md"
        echo "3. EXTEND existing component instead of creating new one"
        echo "4. If >30% overlap exists: MUST enhance existing, not create duplicate"
        echo ""
        echo -e "${YELLOW}To override (NOT RECOMMENDED):${NC}"
        echo "export BYPASS_INTEGRATION_ANALYSIS=true"
        echo ""
        exit 1  # BLOCK with exit 1
    fi

    # Check if analysis exists
    if ! has_integration_analysis "$file"; then
        echo -e "${YELLOW}⚠️ No recent integration analysis found${NC}"
        echo -e "${BLUE}🔍 Running integration discovery...${NC}"

        if ! run_integration_discovery "$file"; then
            echo -e "${RED}❌ Integration analysis failed${NC}"
            echo ""
            echo -e "${RED}🚨 BLOCKED: Cannot proceed without integration analysis${NC}"
            echo ""
            echo -e "${BLUE}Required Actions:${NC}"
            echo "1. Investigate why analysis failed"
            echo "2. Run manual analysis: ./docs/scripts/integration-discovery.sh <component>"
            echo "3. Understand all dependencies and integrations"
            echo ""
            exit 1  # BLOCK with exit 1
        fi
        echo ""
    else
        echo -e "${GREEN}✅ Recent integration analysis found${NC}"
        echo ""
    fi

    # Display analysis results
    if ! display_analysis_and_get_approval "$file"; then
        echo -e "${RED}❌ Cannot proceed without proper analysis${NC}"
        echo -e "${RED}Action required: Manual analysis needed${NC}"
        echo ""
        echo -e "${RED}🚨 BLOCKED: Component status UNKNOWN or HIGH RISK${NC}"
        echo ""
        echo -e "${BLUE}Required Actions:${NC}"
        echo "1. Review the component/service thoroughly"
        echo "2. Understand all integrations and dependencies"
        echo "3. Follow the Integration Analysis Framework"
        echo "4. Determine component status (ACTIVE, SHARED, ORPHANED, LEGACY)"
        echo "5. Select appropriate modification strategy"
        echo ""
        echo -e "${BLUE}Reference Documents:${NC}"
        echo "- docs/INTEGRATION-FIRST-METHODOLOGY.md"
        echo "- docs/INTEGRATION-ANALYSIS-FRAMEWORK.md"
        echo "- docs/INTEGRATION-ANALYSIS-CASE-STUDIES.md"
        echo ""
        exit 1  # BLOCK with exit 1
    fi

    # Enforce architectural guidelines
    enforce_architectural_guidelines "$file" "$change_type"

    # Create audit trail
    local audit_file="$ANALYSIS_CACHE/audit.log"
    echo "$(date -Iseconds) | $change_type | $file | $(whoami) | Analysis completed" >> "$audit_file"

    echo -e "${GREEN}🎯 Integration analysis enforcement complete${NC}"
    echo -e "${BLUE}You may now proceed with the modification${NC}"
    echo ""
    echo -e "${PURPLE}🚀 ENHANCED VALIDATION AVAILABLE:${NC}"
    echo "For comprehensive integration analysis and validation, run:"
    echo ""
    echo -e "${YELLOW}📋 Before major changes:${NC}"
    echo "  ./docs/scripts/integration-discovery.sh $(basename \"$file\" .tsx)"
    echo "  ./docs/scripts/integration-analysis-validator.sh \"$file\""
    echo ""
    echo -e "${YELLOW}📋 After making changes:${NC}"
    echo "  ./docs/scripts/integration-preservation-checker.sh \"$file\""
    echo ""
    echo -e "${BLUE}💡 Remember:${NC}"
    echo "- Follow the identified strategy (PRESERVE_AND_ENHANCE, etc.)"
    echo "- Create backups before making changes"
    echo "- Test all integrations after modification"
    echo "- Document any architectural decisions made"
    echo ""
    echo -e "${RED}🚨 CRITICAL REMINDER: Case Study Lessons${NC}"
    echo "This framework prevents catastrophic mistakes like nearly deleting"
    echo "955 lines of advanced features from LeadManager.tsx while breaking"
    echo "ResponsiveUnifiedLeadsView.tsx integrations. Integration analysis SAVES features!"

    exit 0
}

# Run main function
main "$@"