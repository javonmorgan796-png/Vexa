---
name: Monorepo import installation
description: Dependency installation behavior after importing a pnpm workspace into a Replit project
---

When an imported pnpm workspace already declares package dependencies, a project-level package installer may incorrectly target the workspace root and refuse the operation; use the workspace's pnpm install flow to reconcile the lockfile and package links.

**Why:** The imported frontend initially had valid package declarations but its lockfile was stale after artifact registration, so the root-targeted installer could not install the workspace package dependencies.

**How to apply:** After importing or restoring a workspace package, run the repository-aware install and then restart the affected managed workflow before judging the preview.