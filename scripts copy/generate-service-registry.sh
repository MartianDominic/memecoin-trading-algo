#!/bin/bash
# Auto-generate Service Registry for Documentation
# This script creates an accurate service registry from the actual codebase
# Usage: ./scripts/generate-service-registry.sh > docs/SERVICE-REGISTRY.md

echo "# Service Registry - Auto-Generated"
echo ""
echo "**Generated**: $(date +%Y-%m-%d)"
echo "**Purpose**: Accurate mapping of all services in the codebase"
echo ""
echo "---"
echo ""

echo "## Primary Services (\`src/lib/services/\`)"
echo ""
echo "| Service | File | Size | Purpose |"
echo "|---------|------|------|---------|"

# Find all service files in src/lib/services/, sort by name
find src/lib/services -name "*.ts" -type f ! -name "index.ts" | sort | while read file; do
    filename=$(basename "$file")
    size=$(ls -lh "$file" | awk '{print $5}')
    # Extract purpose from first JSDoc comment or first export
    purpose=$(head -30 "$file" | grep -A 2 "@description\|@purpose\|class.*{" | head -1 | sed 's/.*@description //; s/.*@purpose //; s/.*class /Class: /; s/{//g' | xargs)
    if [ -z "$purpose" ]; then
        purpose="Service implementation"
    fi
    echo "| ${filename%.ts} | \`$file\` | $size | $purpose |"
done

echo ""
echo "---"
echo ""

echo "## Utility Services (\`src/lib/\`)"
echo ""
echo "| Service | File | Size | Purpose |"
echo "|---------|------|------|---------|"

# Find service files in src/lib/ root (exclude subdirectories)
find src/lib -maxdepth 1 -name "*Service.ts" -o -name "*service.ts" | sort | while read file; do
    filename=$(basename "$file")
    size=$(ls -lh "$file" | awk '{print $5}')
    purpose=$(head -30 "$file" | grep -A 2 "@description\|@purpose" | head -1 | sed 's/.*@description //; s/.*@purpose //' | xargs)
    if [ -z "$purpose" ]; then
        purpose="Utility service"
    fi
    echo "| ${filename%.ts} | \`$file\` | $size | $purpose |"
done

echo ""
echo "---"
echo ""

echo "## Supporting Infrastructure"
echo ""
echo "| Component | File | Size | Purpose |"
echo "|-----------|------|------|---------|"

# Data/Session/Error managers
for pattern in "*Manager.ts" "*Handler.ts"; do
    find src/lib -maxdepth 1 -name "$pattern" 2>/dev/null | sort | while read file; do
        filename=$(basename "$file")
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "| ${filename%.ts} | \`$file\` | $size | Infrastructure component |"
    done
done

echo ""
echo "---"
echo ""

echo "## Archived Services (\`src/lib/_archived_legacy_services/\`)"
echo ""
echo "⚠️ **Status**: ARCHIVED - Do not use in new code"
echo ""
echo "| Service | File | Size | Notes |"
echo "|---------|------|------|-------|"

find src/lib/_archived_legacy_services -name "*.ts" -type f 2>/dev/null | sort | while read file; do
    filename=$(basename "$file")
    size=$(ls -lh "$file" | awk '{print $5}')
    echo "| ${filename%.ts} | \`$file\` | $size | ⚠️ ARCHIVED - Legacy code |"
done

echo ""
echo "---"
echo ""

echo "## Service Count Summary"
echo ""
primary_count=$(find src/lib/services -name "*.ts" -type f ! -name "index.ts" | wc -l)
utility_count=$(find src/lib -maxdepth 1 -name "*Service.ts" -o -name "*service.ts" | wc -l)
infra_count=$(find src/lib -maxdepth 1 \( -name "*Manager.ts" -o -name "*Handler.ts" \) | wc -l)
archived_count=$(find src/lib/_archived_legacy_services -name "*.ts" -type f 2>/dev/null | wc -l)
total=$((primary_count + utility_count + infra_count))

echo "- **Primary Services**: $primary_count"
echo "- **Utility Services**: $utility_count"
echo "- **Infrastructure**: $infra_count"
echo "- **Total Active**: $total"
echo "- **Archived**: $archived_count"
echo ""

echo "---"
echo ""
echo "## Integration Patterns"
echo ""
echo "### Standard Service Import Pattern"
echo '```typescript'
echo "// Primary services"
echo "import { ServiceOrchestrator } from '@/lib/services/ServiceOrchestrator';"
echo "import { CampaignService } from '@/lib/services/CampaignService';"
echo "import { LeadService } from '@/lib/services/LeadService';"
echo ""
echo "// Utility services"
echo "import { instagramService } from '@/lib/instagramService';"
echo "import { fileStorageService } from '@/lib/fileStorageService';"
echo '```'
echo ""

echo "### Service Usage Pattern"
echo '```typescript'
echo "// All service methods follow workspace-first pattern"
echo "const result = await ServiceOrchestrator.method(workspaceId, ...params);"
echo ""
echo "// Example"
echo "const campaigns = await ServiceOrchestrator.getCampaigns(workspaceId, filters);"
echo '```'
echo ""

echo "---"
echo ""
echo "**Registry maintained by**: \`scripts/generate-service-registry.sh\`"
echo ""
echo "**Update command**: \`./scripts/generate-service-registry.sh > docs/SERVICE-REGISTRY.md\`"