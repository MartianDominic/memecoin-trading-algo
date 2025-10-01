#!/bin/bash
# Auto-generate Component Registry for Documentation
# This script creates an accurate component registry from the actual codebase
# Usage: ./scripts/generate-component-registry.sh > docs/COMPONENT-REGISTRY.md

echo "# Component Registry - Auto-Generated"
echo ""
echo "**Generated**: $(date +%Y-%m-%d)"
echo "**Purpose**: Accurate mapping of all components in the codebase"
echo ""
echo "---"
echo ""

echo "## Page Components (\`src/pages/\`)"
echo ""
echo "| Component | File | Used in Routing | Status |"
echo "|-----------|------|-----------------|--------|"

# Check which components are imported in App.tsx
find src/pages -name "*.tsx" -type f | sort | while read file; do
    filename=$(basename "$file" .tsx)
    # Check if imported in App.tsx
    if grep -q "from.*$filename" src/App.tsx 2>/dev/null; then
        routing="✅ Yes"
        status="✅ ACTIVE"
    else
        routing="❌ No"
        status="⚠️ Not routed"
    fi

    echo "| $filename | \`$file\` | $routing | $status |"
done

echo ""
echo "---"
echo ""

echo "## Feature Components"
echo ""

# Campaign components
echo "### Campaign Management (\`src/components/campaign/\`)"
echo ""
echo "| Component | File | Purpose |"
echo "|-----------|------|---------|"
find src/components/campaign -name "*.tsx" -type f | sort | while read file; do
    filename=$(basename "$file" .tsx)
    echo "| $filename | \`$file\` | Campaign feature |"
done
echo ""

# Lead components
if [ -d "src/components/leads" ]; then
    echo "### Lead Management (\`src/components/leads/\`)"
    echo ""
    echo "| Component | File | Purpose |"
    echo "|-----------|------|---------|"
    find src/components/leads -name "*.tsx" -type f | sort | while read file; do
        filename=$(basename "$file" .tsx)
        echo "| $filename | \`$file\` | Lead management feature |"
    done
    echo ""
fi

# Account components
if [ -d "src/components/accounts" ]; then
    echo "### Account Management (\`src/components/accounts/\`)"
    echo ""
    echo "| Component | File | Purpose |"
    echo "|-----------|------|---------|"
    find src/components/accounts -name "*.tsx" -type f | sort | while read file; do
        filename=$(basename "$file" .tsx)
        echo "| $filename | \`$file\` | Account management feature |"
    done
    echo ""
fi

# Inbox components
if [ -d "src/components/inbox" ]; then
    echo "### Inbox/Messages (\`src/components/inbox/\`)"
    echo ""
    echo "| Component | File | Purpose |"
    echo "|-----------|------|---------|"
    find src/components/inbox -name "*.tsx" -type f | sort | while read file; do
        filename=$(basename "$file" .tsx)
        echo "| $filename | \`$file\` | Inbox/messaging feature |"
    done
    echo ""
fi

# Analytics components
if [ -d "src/components/analytics" ]; then
    echo "### Analytics (\`src/components/analytics/\`)"
    echo ""
    echo "| Component | File | Purpose |"
    echo "|-----------|------|---------|"
    find src/components/analytics -name "*.tsx" -type f | sort | while read file; do
        filename=$(basename "$file" .tsx)
        echo "| $filename | \`$file\` | Analytics feature |"
    done
    echo ""
fi

echo "---"
echo ""

echo "## Manager Components"
echo ""
echo "| Component | File | Domain | Status |"
echo "|-----------|------|--------|--------|"

find src/components -name "*Manager.tsx" | sort | while read file; do
    filename=$(basename "$file" .tsx)

    # Check if in archived directory
    if echo "$file" | grep -q "_archived_orphaned"; then
        status="⚠️ ARCHIVED"
    else
        status="✅ ACTIVE"
    fi

    # Determine domain from path
    domain=$(echo "$file" | sed 's|src/components/||; s|/.*||')

    echo "| $filename | \`$file\` | $domain | $status |"
done

echo ""
echo "---"
echo ""

echo "## Archived/Orphaned Components"
echo ""
echo "⚠️ **Status**: ARCHIVED - Not imported anywhere in codebase"
echo ""
echo "| Component | File | Reason |"
echo "|-----------|------|--------|"

find src/components/_archived_orphaned -name "*.tsx" -type f 2>/dev/null | sort | while read file; do
    filename=$(basename "$file" .tsx)

    # Check if imported anywhere
    if grep -rq "import.*$filename" src/ 2>/dev/null; then
        reason="⚠️ Still imported (needs review)"
    else
        reason="❌ Not imported - Safe to delete"
    fi

    echo "| $filename | \`$file\` | $reason |"
done

echo ""
echo "---"
echo ""

echo "## Duplicate Components"
echo ""
echo "⚠️ **Components with Similar Names** - Potential duplicates requiring review"
echo ""
echo "| Component Pair | Files | Notes |"
echo "|----------------|-------|-------|"

# Check for CampaignCreate duplication
if [ -f "src/pages/CampaignCreate.tsx" ] && [ -f "src/pages/CampaignCreateRefactored.tsx" ]; then
    active=$(grep -q "CampaignCreate" src/App.tsx && echo "✅ ACTIVE" || echo "❌ Not used")
    refactored=$(grep -q "CampaignCreateRefactored" src/App.tsx && echo "✅ ACTIVE" || echo "❌ Not used")
    echo "| CampaignCreate vs CampaignCreateRefactored | \`src/pages/CampaignCreate.tsx\` ($active) <br> \`src/pages/CampaignCreateRefactored.tsx\` ($refactored) | **DUPLICATE DETECTED** |"
fi

echo ""
echo "---"
echo ""

echo "## Component Count Summary"
echo ""
pages_count=$(find src/pages -name "*.tsx" -type f | wc -l)
campaign_count=$(find src/components/campaign -name "*.tsx" -type f 2>/dev/null | wc -l)
manager_count=$(find src/components -name "*Manager.tsx" ! -path "*/_ archived_orphaned/*" | wc -l)
archived_count=$(find src/components/_archived_orphaned -name "*.tsx" -type f 2>/dev/null | wc -l)
total_components=$(find src/components -name "*.tsx" -type f ! -path "*/ui/*" ! -path "*/_archived_orphaned/*" | wc -l)

echo "- **Page Components**: $pages_count"
echo "- **Campaign Components**: $campaign_count"
echo "- **Manager Components**: $manager_count"
echo "- **Total Feature Components**: $total_components"
echo "- **Archived Components**: $archived_count"
echo ""

echo "---"
echo ""
echo "## Integration Patterns"
echo ""
echo "### Standard Page Component Pattern"
echo '```typescript'
echo "import { useParams } from 'react-router-dom';"
echo "import { useQuery } from '@tanstack/react-query';"
echo "import { ServiceOrchestrator } from '@/lib/services/ServiceOrchestrator';"
echo ""
echo "const MyPage = () => {"
echo "  const { workspaceId } = useParams<{ workspaceId: string }>();"
echo ""
echo "  const { data } = useQuery({"
echo "    queryKey: ['resource', workspaceId],"
echo "    queryFn: () => ServiceOrchestrator.getResource(workspaceId!),"
echo "    enabled: !!workspaceId"
echo "  });"
echo ""
echo "  return <div>Content</div>;"
echo "};"
echo '```'
echo ""

echo "---"
echo ""
echo "**Registry maintained by**: \`scripts/generate-component-registry.sh\`"
echo ""
echo "**Update command**: \`./scripts/generate-component-registry.sh > docs/COMPONENT-REGISTRY.md\`"