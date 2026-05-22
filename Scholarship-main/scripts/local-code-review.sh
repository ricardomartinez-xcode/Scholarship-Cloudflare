#!/bin/bash

# Local Code Review Script
# This script mimics the automated code review that runs on push to main
# Run this before pushing to catch issues early

echo "🤖 Running Local Code Review..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create temp directory for results
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📁 Temporary results directory: $TEMP_DIR"
echo ""

# Run ESLint
echo "🔍 Running ESLint..."
npm run lint -- --format json --output-file "$TEMP_DIR/eslint-results.json" 2>&1 || true
ESLINT_EXIT=$?

if [ -f "$TEMP_DIR/eslint-results.json" ]; then
    ERROR_COUNT=$(node -e "
        const fs = require('fs');
        try {
            const results = JSON.parse(fs.readFileSync('$TEMP_DIR/eslint-results.json', 'utf8'));
            let count = 0;
            results.forEach(file => {
                file.messages.forEach(msg => {
                    if (msg.severity === 2) count++;
                });
            });
            console.log(count);
        } catch (e) {
            console.log(0);
        }
    ")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "${RED}❌ Found $ERROR_COUNT ESLint error(s)${NC}"
    else
        echo -e "${GREEN}✅ No ESLint errors found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  ESLint results not available${NC}"
fi
echo ""

# Run TypeScript type check
echo "🔍 Running TypeScript type check..."
npx tsc --noEmit > "$TEMP_DIR/typescript-errors.txt" 2>&1 || true
TS_EXIT=$?

if [ -f "$TEMP_DIR/typescript-errors.txt" ] && [ -s "$TEMP_DIR/typescript-errors.txt" ]; then
    ERROR_COUNT=$(grep -c "error TS[0-9]*:" "$TEMP_DIR/typescript-errors.txt" || echo "0")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "${RED}❌ Found $ERROR_COUNT TypeScript error(s)${NC}"
    else
        echo -e "${GREEN}✅ No TypeScript errors found${NC}"
    fi
else
    echo -e "${GREEN}✅ No TypeScript errors found${NC}"
fi
echo ""

# Generate report
echo "📝 Generating report..."
REPORT_FILE="$TEMP_DIR/local-code-review.md"

cat > "$REPORT_FILE" << 'EOF'
# Local Code Review Report

This report contains medium-high to high severity issues found in the codebase.

## ESLint Issues

EOF

if [ -f "$TEMP_DIR/eslint-results.json" ]; then
    node -e "
        const fs = require('fs');
        try {
            const results = JSON.parse(fs.readFileSync('$TEMP_DIR/eslint-results.json', 'utf8'));
            let hasIssues = false;
            results.forEach(file => {
                if (file.errorCount > 0) {
                    hasIssues = true;
                    console.log('### ' + file.filePath.replace(process.cwd() + '/', ''));
                    console.log('');
                    file.messages.forEach(msg => {
                        if (msg.severity === 2) {
                            console.log('- **Line ' + msg.line + ':' + msg.column + '**: ' + msg.message);
                            console.log('  - Rule: \`' + msg.ruleId + '\`');
                            console.log('  - Severity: ERROR');
                            console.log('');
                        }
                    });
                    console.log('');
                }
            });
            if (!hasIssues) {
                console.log('✅ No ESLint errors found.');
                console.log('');
            }
        } catch (e) {
            console.log('❌ Failed to parse ESLint results.');
            console.log('');
        }
    " >> "$REPORT_FILE"
else
    echo "✅ No ESLint errors found." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << 'EOF'

## TypeScript Type Errors

EOF

if [ -f "$TEMP_DIR/typescript-errors.txt" ] && [ -s "$TEMP_DIR/typescript-errors.txt" ]; then
    grep -E "error TS[0-9]+:" "$TEMP_DIR/typescript-errors.txt" | head -20 >> "$REPORT_FILE" || echo "✅ No TypeScript errors found." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
else
    echo "✅ No TypeScript errors found." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << 'EOF'

## Instructions for AI Repair

To repair the issues found above, an AI assistant (GitHub Copilot/GPT-4/Claude/Gemini) should:

1. **For ESLint Errors**:
   - Review each error and its context in the file
   - Apply the recommended fix based on the ESLint rule
   - Ensure the fix doesn't break existing functionality
   - Run `npm run lint` to verify the fix

2. **For TypeScript Errors**:
   - Analyze the type mismatch or error
   - Add proper type annotations or fix type inconsistencies
   - Ensure type safety is maintained throughout the codebase
   - Run `npx tsc --noEmit` to verify all type errors are resolved

3. **General Guidelines**:
   - Make minimal changes to fix each issue
   - Test changes locally before committing
   - Follow existing code style and conventions
   - Document any complex changes
EOF

echo -e "${GREEN}✅ Report generated${NC}"
echo ""

# Display summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💾 Full report saved to: $REPORT_FILE"
echo ""

# Ask if user wants to save the report
read -p "Do you want to save this report to ./code-review-local.md? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$REPORT_FILE" ./code-review-local.md
    echo -e "${GREEN}✅ Report saved to ./code-review-local.md${NC}"
fi
