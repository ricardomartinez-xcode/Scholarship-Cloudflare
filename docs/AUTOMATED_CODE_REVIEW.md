# Automated Code Review System

## Overview
This repository has an automated code review system that runs on every push to the `main` branch. The system is designed to identify and report medium-high to high severity issues without interfering with the development workflow.

## What Gets Reviewed

### 1. ESLint Issues
- **Severity Level**: Only ERROR level issues (severity 2)
- **Excluded**: Warnings and informational messages
- **Output**: Detailed report with file location, line number, and rule violated

### 2. TypeScript Type Errors
- **Check**: Type consistency and correctness
- **Output**: Compilation errors with locations and descriptions

## How It Works

### Trigger
The workflow automatically runs when:
- A push is made to the `main` branch

### Process
1. **Checkout**: Pulls the latest code
2. **Setup**: Installs Node.js and project dependencies
3. **ESLint Check**: Runs ESLint with JSON output for parsing
4. **TypeScript Check**: Runs type checking without emitting files
5. **Report Generation**: Creates a markdown report with:
   - All medium-high/high severity issues
   - File locations and line numbers
   - Detailed error descriptions
   - AI repair instructions
6. **Artifact Upload**: Saves the report for 30 days
7. **Commit Comment**: Posts a comment on the commit if issues are found
8. **Summary**: Displays the report in the GitHub Actions summary

## Report Format

The automated report includes:

### ESLint Issues Section
```markdown
### path/to/file.ts
- **Line 15:3**: Expected '===' and instead saw '=='
  - Rule: `eqeqeq`
  - Severity: ERROR
```

### TypeScript Errors Section
```
path/to/file.ts(25,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

### AI Repair Instructions
Detailed steps for an AI assistant (GitHub Copilot/GPT-4/Claude/Gemini) to fix the issues, including:
- How to approach ESLint errors
- How to fix TypeScript type errors
- General guidelines for making changes

## Accessing Reports

### 0. Run Locally (Before Pushing)
You can run the same checks locally before pushing to catch issues early:

```bash
./scripts/local-code-review.sh
```

This will:
- Run ESLint checks
- Run TypeScript type checks
- Generate a report with the same format as CI
- Optionally save the report to `code-review-local.md`

### 1. GitHub Actions Summary
- Go to Actions tab in GitHub
- Click on the latest "Automated Code Review on Push to Main" workflow run
- View the summary at the bottom of the page

### 2. Artifacts
- In the workflow run, find the "Artifacts" section
- Download "code-review-report" to get:
  - `code-review-report.md` - Human-readable markdown report
  - `eslint-results.json` - Raw ESLint output
  - `typescript-errors.txt` - Raw TypeScript errors

### 3. Commit Comments
- If issues are found, a comment will be posted directly on the commit
- Navigate to the commit in GitHub to view the comment

## Philosophy

### Non-Intrusive
- **Reviews only, doesn't auto-fix**: The system reports issues but doesn't automatically modify code
- **Filters by severity**: Only medium-high to high severity issues are reported
- **Developer-friendly**: Provides clear instructions for fixing issues

### AI-Ready
- Reports are structured for AI assistants to understand and act upon
- Clear instructions for Codex, Claude Opus, Gemini, or similar tools
- Minimal changes approach recommended

## Disabling the System

To disable the automated code review:

### Option 1: Delete the Workflow File
```bash
rm .github/workflows/code-review-on-push.yml
git add .github/workflows/code-review-on-push.yml
git commit -m "Disable automated code review"
git push
```

### Option 2: Disable in GitHub UI
1. Go to Settings → Actions → General
2. Set "Actions permissions" to disable actions
3. Or go to the Actions tab and disable the specific workflow

### Option 3: Comment Out the Trigger
Edit `.github/workflows/code-review-on-push.yml` and comment out the `on` section:
```yaml
# on:
#   push:
#     branches:
#       - main
```

## Customization

### Adjusting Severity Levels
Edit the workflow file and modify the severity filter:
- Current: `msg.severity === 2` (errors only)
- Include warnings: `msg.severity >= 1`

### Changing Target Branch
Modify the `on.push.branches` section in the workflow file:
```yaml
on:
  push:
    branches:
      - main
      - develop  # Add more branches
```

### Adding More Checks
You can add additional steps to the workflow, such as:
- Security scanning (e.g., npm audit)
- Code complexity analysis
- Test coverage checks

## Troubleshooting

### Workflow Not Running
1. Check if GitHub Actions are enabled in repository settings
2. Verify the workflow file syntax is correct
3. Ensure pushes are being made to the `main` branch

### No Report Generated
1. Check workflow logs in the Actions tab
2. Verify dependencies install correctly
3. Ensure ESLint and TypeScript are configured properly

### False Positives
1. Review ESLint rules in `eslint.config.mjs`
2. Adjust TypeScript strict mode settings in `tsconfig.json`
3. Add specific ignores for known issues

## Support

For issues or questions about the automated code review system:
1. Check the workflow logs in the Actions tab
2. Review this documentation
3. Create an issue in the repository with the `automation` label
