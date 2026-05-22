#!/usr/bin/env bash
set -euo pipefail

REMOTE="${1:-origin}"
DEV_BRANCH="${2:-development}"
MAIN_BRANCH="${3:-main}"
STABLE_BRANCH="${4:-last-stable}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash changes before promoting." >&2
  exit 1
fi

git fetch "$REMOTE" --prune

ensure_branch() {
  local branch="$1"
  local remote_ref="$REMOTE/$branch"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    return
  fi
  if git show-ref --verify --quiet "refs/remotes/$remote_ref"; then
    git checkout -b "$branch" "$remote_ref"
    return
  fi
  if [[ "$branch" == "$DEV_BRANCH" || "$branch" == "$MAIN_BRANCH" ]]; then
    echo "Remote branch '$remote_ref' not found." >&2
    exit 1
  fi
  git checkout -b "$branch"
}

ensure_branch "$DEV_BRANCH"
ensure_branch "$MAIN_BRANCH"
ensure_branch "$STABLE_BRANCH"

git checkout "$STABLE_BRANCH"
git reset --hard "$REMOTE/$MAIN_BRANCH"
git push "$REMOTE" "$STABLE_BRANCH" --force-with-lease

git checkout "$MAIN_BRANCH"
git reset --hard "$REMOTE/$DEV_BRANCH"
git push "$REMOTE" "$MAIN_BRANCH" --force-with-lease

git checkout "$DEV_BRANCH"
echo "Promotion complete: $DEV_BRANCH -> $MAIN_BRANCH, $MAIN_BRANCH -> $STABLE_BRANCH"
