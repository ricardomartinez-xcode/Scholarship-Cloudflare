# Legacy Neon Database

This directory contains retired Neon-specific runtime helpers, migration
scripts, documentation, and a manual GitHub workflow. It is excluded from the
Next.js source tree, active `.github/workflows`, and Vercel build.

The root package no longer installs `@neondatabase/serverless`. Running these
historical scripts requires an explicit, reviewed rollback environment and its
own dependencies. They are not authentication dependencies and must never run
automatically during build or deployment.
