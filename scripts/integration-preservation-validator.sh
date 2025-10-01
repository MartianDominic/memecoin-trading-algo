#!/bin/bash

# Integration Preservation Validator Hook
# Validates that integrations are preserved after component/service modifications

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

# Function to validate component integrations
validate_component_integrations() {
    local file="$1"
    local component_name=$(basename "$file" .tsx)
    component_name=$(basename "$component_name" .ts)

    echo -e "${BLUE}🔍 Validating integrations for: $component_name${NC}"

    local issues_found=false
    local validation_report="$ANALYSIS_CACHE/${component_name}_validation.md"

    cat > "$validation_report" << EOF
# Integration Validation Report: $component_name

**File**: $file
**Validation Date**: $(date)
**Validator**: Claude Integration Preservation Validator

## Integration Validation Results

EOF

    # Check if file exists (might have been deleted)
    if [[ ! -f "$file" ]]; then
        echo "### File Status" >> "$validation_report"
        echo "**Status**: ❌ FILE DELETED" >> "$validation_report"
        echo "" >> "$validation_report"

        # Check if something else is importing this deleted file (broken imports)
        local broken_imports=$(grep -r "import.*$component_name\|from.*$component_name" src/ 2>/dev/null || true)
        if [[ -n "$broken_imports" ]]; then
            echo "### ⛔ CRITICAL: Broken Imports Detected" >> "$validation_report"
            echo "$broken_imports" | sed 's/^/- /' >> "$validation_report"
            echo "" >> "$validation_report"
            echo -e "${RED}❌ CRITICAL: Broken imports detected for deleted component${NC}"
            issues_found=true
        fi

        # Check if something is still trying to use this in JSX
        local broken_jsx=$(grep -r "<$component_name" src/ 2>/dev/null || true)
        if [[ -n "$broken_jsx" ]]; then
            echo "### ⛔ CRITICAL: Broken JSX Usage Detected" >> "$validation_report"
            echo "$broken_jsx" | sed 's/^/- /' >> "$validation_report"
            echo "" >> "$validation_report"
            echo -e "${RED}❌ CRITICAL: Broken JSX usage detected for deleted component${NC}"
            issues_found=true
        fi

        # Check routing references
        local broken_routing=$(grep -r "$component_name" src/App.tsx src/router/ src/routes/ 2>/dev/null || true)
        if [[ -n "$broken_routing" ]]; then
            echo "### ⛔ CRITICAL: Broken Routing Detected" >> "$validation_report"
            echo "$broken_routing" | sed 's/^/- /' >> "$validation_report"
            echo "" >> "$validation_report"
            echo -e "${RED}❌ CRITICAL: Broken routing detected for deleted component${NC}"
            issues_found=true
        fi
    else
        echo "### File Status" >> "$validation_report"
        echo "**Status**: ✅ FILE EXISTS" >> "$validation_report"
        echo "" >> "$validation_report"

        # Validate that file is syntactically correct
        if ! node -c "$file" 2>/dev/null && ! npx tsc --noEmit "$file" 2>/dev/null; then
            echo "### ⛔ CRITICAL: Syntax Errors Detected" >> "$validation_report"
            echo "**Status**: ❌ FILE HAS SYNTAX ERRORS" >> "$validation_report"
            echo "" >> "$validation_report"
            echo -e "${RED}❌ CRITICAL: Syntax errors in modified file${NC}"
            issues_found=true
        fi

        # Check if imports are still valid
        local import_errors=""
        while IFS= read -r import_line; do
            local import_path=$(echo "$import_line" | sed -n "s/.*from ['\"]\\([^'\"]*\\)['\"].*/\\1/p")
            if [[ -n "$import_path" ]] && [[ "$import_path" =~ ^\. ]]; then
                # Relative import - check if file exists
                local full_path=$(dirname "$file")/"$import_path"
                if [[ ! -f "$full_path.ts" ]] && [[ ! -f "$full_path.tsx" ]] && [[ ! -f "$full_path/index.ts" ]] && [[ ! -f "$full_path/index.tsx" ]]; then
                    import_errors+="- Broken import: $import_path in line: $import_line"$'\n'
                fi
            fi
        done < <(grep "import.*from" "$file" 2>/dev/null || true)

        if [[ -n "$import_errors" ]]; then
            echo "### ⚠️ Import Issues Detected" >> "$validation_report"
            echo "$import_errors" >> "$validation_report"
            echo "" >> "$validation_report"
            echo -e "${YELLOW}⚠️ WARNING: Potential import issues detected${NC}"
        fi
    fi

    # Compare with previous analysis if available
    local previous_analysis="$ANALYSIS_CACHE/${component_name}_analysis.json"
    if [[ -f "$previous_analysis" ]]; then
        local previous_status=$(grep -o '"status": "[^"]*"' "$previous_analysis" | cut -d'"' -f4)

        echo "### Integration Status Comparison" >> "$validation_report"
        echo "**Previous Status**: $previous_status" >> "$validation_report"

        # Re-run integration discovery to compare
        local current_status="UNKNOWN"
        if [[ -f "$file" ]]; then
            if grep -r "import.*$component_name\|from.*$component_name" src/ >/dev/null 2>&1; then
                if grep -r "<$component_name" src/ >/dev/null 2>&1; then
                    current_status="ACTIVE"
                else
                    current_status="IMPORTED_BUT_UNUSED"
                fi
            elif grep -r "$component_name" src/App.tsx src/router/ src/routes/ >/dev/null 2>&1; then
                current_status="ROUTING_INTEGRATED"
            else
                current_status="ORPHANED"
            fi
        else
            current_status="DELETED"
        fi

        echo "**Current Status**: $current_status" >> "$validation_report"

        # Check for status downgrades that might indicate broken integrations
        if [[ "$previous_status" == "ACTIVE" ]] && [[ "$current_status" != "ACTIVE" ]]; then
            echo "**⛔ CRITICAL**: Component downgraded from ACTIVE to $current_status" >> "$validation_report"
            echo -e "${RED}❌ CRITICAL: Active component status downgraded${NC}"
            issues_found=true
        elif [[ "$previous_status" == "ROUTING_INTEGRATED" ]] && [[ "$current_status" == "ORPHANED" ]]; then
            echo "**⚠️ WARNING**: Component lost routing integration" >> "$validation_report"
            echo -e "${YELLOW}⚠️ WARNING: Routing integration lost${NC}"
        fi

        echo "" >> "$validation_report"
    fi

    # Run basic compilation check for TypeScript files
    if [[ -f "$file" ]] && [[ "$file" =~ \.(ts|tsx)$ ]]; then
        echo "### TypeScript Validation" >> "$validation_report"
        if npx tsc --noEmit "$file" 2>/dev/null; then
            echo "**TypeScript**: ✅ No type errors" >> "$validation_report"
        else
            echo "**TypeScript**: ❌ Type errors detected" >> "$validation_report"
            echo -e "${RED}❌ TypeScript errors detected${NC}"
            issues_found=true
        fi
        echo "" >> "$validation_report"
    fi

    echo -e "${BLUE}📄 Validation report: $validation_report${NC}"

    if [[ "$issues_found" == "true" ]]; then
        echo -e "${RED}❌ Integration validation FAILED${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Integration validation PASSED${NC}"
        return 0
    fi
}

# Function to validate service integrations
validate_service_integrations() {
    local file="$1"
    local service_name=$(basename "$file" .ts)

    echo -e "${BLUE}🔍 Validating service integrations for: $service_name${NC}"

    local issues_found=false

    # Check if service is being imported
    local service_usage=$(grep -r "import.*$service_name\|from.*$service_name" src/ 2>/dev/null || true)

    if [[ -f "$file" ]] && [[ -z "$service_usage" ]]; then
        echo -e "${YELLOW}⚠️ WARNING: Service exists but is not imported anywhere${NC}"
        echo -e "${BLUE}This might indicate an orphaned service${NC}"
    elif [[ ! -f "$file" ]] && [[ -n "$service_usage" ]]; then
        echo -e "${RED}❌ CRITICAL: Service deleted but still being imported${NC}"
        echo "Broken imports:"
        echo "$service_usage" | sed 's/^/  /'
        issues_found=true
    fi

    # Check for method signature changes if file exists
    if [[ -f "$file" ]]; then
        # Basic syntax check
        if ! node -c "$file" 2>/dev/null; then
            echo -e "${RED}❌ CRITICAL: Service has syntax errors${NC}"
            issues_found=true
        fi
    fi

    if [[ "$issues_found" == "true" ]]; then
        echo -e "${RED}❌ Service integration validation FAILED${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Service integration validation PASSED${NC}"
        return 0
    fi
}

# Function to run comprehensive validation
run_comprehensive_validation() {
    local file="$1"
    local change_type="$2"

    echo -e "${PURPLE}🔒 INTEGRATION PRESERVATION VALIDATION${NC}"
    echo -e "${BLUE}File: $file${NC}"
    echo -e "${BLUE}Change Type: $change_type${NC}"
    echo ""

    local validation_passed=true

    case $change_type in
        "COMPONENT"|"PAGE")
            if ! validate_component_integrations "$file"; then
                validation_passed=false
            fi
            ;;
        "SERVICE")
            if ! validate_service_integrations "$file"; then
                validation_passed=false
            fi
            ;;
        "ROUTING")
            echo -e "${YELLOW}⚠️ Routing changes detected - manual validation recommended${NC}"
            echo "Please verify:"
            echo "- All routes still work correctly"
            echo "- Navigation patterns preserved"
            echo "- Workspace routing intact"
            ;;
        "TYPES")
            echo -e "${BLUE}🔍 Type changes detected - running TypeScript validation${NC}"
            if ! npx tsc --noEmit 2>/dev/null; then
                echo -e "${RED}❌ TypeScript errors detected after type changes${NC}"
                validation_passed=false
            else
                echo -e "${GREEN}✅ No TypeScript errors${NC}"
            fi
            ;;
    esac

    return $([ "$validation_passed" = true ] && echo 0 || echo 1)
}

# Main execution
main() {
    local file="${FILE:-$1}"

    if [[ -z "$file" ]]; then
        echo -e "${RED}❌ ERROR: No file specified${NC}"
        echo "Usage: $0 <file_path>"
        exit 1
    fi

    # Detect if this is an architectural change
    local change_type=$(detect_architectural_change "$file")

    if [[ -z "$change_type" ]]; then
        echo -e "${GREEN}✅ No architectural validation required for this file${NC}"
        exit 0
    fi

    # Run validation
    if run_comprehensive_validation "$file" "$change_type"; then
        echo ""
        echo -e "${GREEN}🎯 Integration preservation validation PASSED${NC}"
        echo -e "${GREEN}All integrations appear to be preserved${NC}"
        echo ""
        echo -e "${PURPLE}🚀 ENHANCED VALIDATION AVAILABLE:${NC}"
        echo "For comprehensive post-change validation, run:"
        echo "  ./docs/scripts/integration-preservation-checker.sh \"$file\""
        echo ""
        echo -e "${BLUE}This provides:${NC}"
        echo "- 12-point feature preservation checklist validation"
        echo "- Performance impact analysis"
        echo "- Emergency rollback verification"
        echo "- Build and test validation"

        # Log successful validation
        local audit_file="$ANALYSIS_CACHE/audit.log"
        echo "$(date -Iseconds) | VALIDATION_PASSED | $change_type | $file | $(whoami) | Integrations preserved" >> "$audit_file"

        exit 0
    else
        echo ""
        echo -e "${RED}💥 Integration preservation validation FAILED${NC}"
        echo -e "${RED}CRITICAL: Integrations may be broken${NC}"
        echo ""
        echo -e "${YELLOW}Immediate actions required:${NC}"
        echo "1. Review the validation report above"
        echo "2. Fix all broken imports/references"
        echo "3. Test the application thoroughly"
        echo "4. Consider rolling back if issues are severe"
        echo ""
        echo -e "${PURPLE}🔧 COMPREHENSIVE DIAGNOSTIC TOOLS:${NC}"
        echo "Run for detailed analysis and recovery guidance:"
        echo "  ./docs/scripts/integration-preservation-checker.sh \"$file\""
        echo ""
        echo -e "${BLUE}This provides:${NC}"
        echo "- Emergency rollback procedures"
        echo "- Build and compilation validation"
        echo "- Critical issue diagnosis"
        echo "- Step-by-step recovery guidance"
        echo ""
        echo -e "${BLUE}Standard rollback procedure:${NC}"
        echo "- Check for backup files (*.backup.tsx, *.original.tsx)"
        echo "- Restore from git history if needed"
        echo "- Re-run validation after fixes"

        # Log failed validation
        local audit_file="$ANALYSIS_CACHE/audit.log"
        echo "$(date -Iseconds) | VALIDATION_FAILED | $change_type | $file | $(whoami) | Integration issues detected" >> "$audit_file"

        # Exit 0 for non-blocking hooks - warnings are displayed but don't block workflow
        exit 0
    fi
}

# Run main function
main "$@"