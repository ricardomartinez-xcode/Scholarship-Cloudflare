param(
  [string]$Remote = "origin",
  [string]$DevBranch = "development",
  [string]$MainBranch = "main",
  [string]$StableBranch = "last-stable"
)

$ErrorActionPreference = "Stop"

function Ensure-CleanWorkingTree {
  $status = git status --porcelain
  if ($status) {
    throw "Working tree not clean. Commit or stash changes before promoting."
  }
}

function Ensure-BranchExists([string]$branch, [string]$remote) {
  git show-ref --verify --quiet "refs/heads/$branch"
  $exists = $LASTEXITCODE -eq 0
  if (-not $exists) {
    $remoteRef = "$remote/$branch"
    git show-ref --verify --quiet "refs/remotes/$remoteRef"
    $remoteExists = $LASTEXITCODE -eq 0
    if ($remoteExists) {
      git checkout -b $branch $remoteRef
      return
    }
    if ($branch -eq $DevBranch -or $branch -eq $MainBranch) {
      throw "Remote branch '$remoteRef' not found."
    }
    git checkout -b $branch
  }
}

Ensure-CleanWorkingTree
git fetch $Remote --prune

Ensure-BranchExists $DevBranch $Remote
Ensure-BranchExists $MainBranch $Remote
Ensure-BranchExists $StableBranch $Remote

git checkout $MainBranch
git reset --hard "$Remote/$DevBranch"
git push $Remote $MainBranch --force-with-lease

git checkout $StableBranch
# Use local $MainBranch HEAD so stable always matches the just-promoted main
# without requiring an extra fetch.
git reset --hard $MainBranch
git push $Remote $StableBranch --force-with-lease

git checkout $DevBranch
Write-Host "Promotion complete: $DevBranch -> $MainBranch, $MainBranch -> $StableBranch"
