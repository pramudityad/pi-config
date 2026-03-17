---
description: Generate or update hierarchical AGENTS.md files for the current project using scout → worker chain
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent with thoroughness=thorough to explore the current project for AGENTS.md generation. The scout should:
   - Map the full directory structure (find . -type f | head -200, tree if available)
   - Read package.json (name, scripts, dependencies, devDependencies)
   - Read config files: tsconfig.json, .eslintrc*, prettier*, jest.config*, playwright.config*, next.config*, vite.config*, docker-compose*, Makefile, etc.
   - Read .env.example or .env.local.example for required environment variables
   - Read any existing AGENTS.md or CLAUDE.md files (root and subdirectories)
   - Sample 2-3 source files from each major directory to detect naming conventions, import patterns, architecture layers
   - Check for monorepo structure (workspaces in package.json, lerna.json, turbo.json, nx.json)
   - Identify which subdirectories are substantial enough to warrant their own AGENTS.md (have distinct patterns, >5 files, clear purpose)
   - Note the git remote URL if available (git remote -v)
   - Report everything in structured format for the next agent

2. Then, use the "worker" agent to generate hierarchical AGENTS.md files based on the scout's findings (use {previous} placeholder). The worker should:

   **A) Generate root AGENTS.md with these sections:**
   - **Project Overview** — One-line description of what the project does
   - **Tech Stack** — Framework, language, database, key libraries with versions
   - **Project Structure** — Key directories and what lives in each (use tree format)
   - **Common Commands** — All useful scripts from package.json, formatted as code blocks
   - **Environment Setup** — Required env vars (from .env.example), services needed, setup steps

   **B) Generate subdirectory AGENTS.md files where appropriate** (e.g., src/, api/, components/, tests/, db/). Each should contain ONLY the sections relevant to that directory:
   - **Code Conventions** — Naming patterns, file organization, import style specific to this directory
   - **Architecture Patterns** — How code in this directory is structured, layers, data flow
   - **Do's and Don'ts** — Rules derived from linting config, tsconfig strictness, and observed patterns
   - **Testing** — How to run tests for this area, patterns, fixtures (for test directories)

   **C) Handle existing files:**
   - If ANY existing AGENTS.md or CLAUDE.md files are found, write each new version to a .agents-md-new temporary file next to it
   - Then show the diff between old and new for EACH file (use `diff -u old new` via bash)
   - Present all diffs to the user and ask for approval before overwriting
   - If no existing files, write the new files directly

   **D) Style guidelines for the generated content:**
   - Be concise — bullet points over paragraphs
   - Be specific — actual commands, actual file paths, actual patterns from the codebase
   - No generic advice — only include what's true for THIS project
   - Use code blocks for commands and patterns
   - Keep each file focused — root file for project-wide info, subdirectory files for local context

Execute this as a chain, passing output between steps via {previous}.
