---
name: Vexa preview setup
description: Runtime requirements for launching the imported Vexa web preview
---

The Vexa app's Vite configuration requires both `PORT` and `BASE_PATH`. The preview workflow must provide the app's configured port and root path; without them Vite exits before opening a port.

**Why:** The repository's artifact metadata can be absent after a root-level import, so a restored preview workflow may not receive artifact-managed environment values automatically.

**How to apply:** When restoring the Vexa preview, use the existing app port and root base path from its artifact metadata rather than changing application routing.