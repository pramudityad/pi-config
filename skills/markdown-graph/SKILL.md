---
name: markdown-graph
description: Use when you need to visualize flows, architecture, processes, or data as diagrams. Triggers on phrases like "draw a flow", "show architecture", "visualize the process", "diagram this", "graph the data", "chart comparison".
---

# Markdown Graph

## Overview

Generate beautiful Unicode/ANSI graphs that render directly in the pi TUI. Uses a custom tool `render_graph` that takes a simple DSL and produces terminal-native diagrams with box-drawing characters and colors.

## When to Use

- User asks to "draw", "visualize", "diagram", "graph", or "chart" something
- Explaining system architecture, data flows, or process sequences
- Comparing data values or showing distributions
- Exploring decision logic or branching paths
- Documenting API flows or service interactions
- Any time a visual representation makes things clearer

## Quick Reference

### Diagram Types

| Type | Header | Use for |
|------|--------|---------|
| Flowchart | `flowchart` | Process flows, decision trees, step-by-step logic |
| Architecture | `architecture` | System components, services, infrastructure |
| Bar chart | `barchart "Title"` | Data comparison, metrics, distributions |

### Node Shapes

| Syntax | Shape | Visual | Use for |
|--------|-------|--------|---------|
| `[Label]` | Rectangle | `╭─────╮` | Processes, services, components |
| `(Label)` | Rounded | `╭─╮ ╭─╮` | Start, end, users, external actors |
| `{Label}` | Diamond | `◇ Label ◇` | Decisions, conditions, gates |
| `((Label))` | Cylinder | `╔═════╗` | Databases, storage, caches |

### Edge Styles

| Syntax | Style | Visual | Use for |
|--------|-------|--------|---------|
| `-->` | Solid arrow | `──▶` | Primary flow / connection |
| `==>` | Bold arrow | `━━▶` | Critical path / main route |
| `-.->` | Dashed arrow | `╌╌▶` | Optional / async / indirect |
| `---` | Line (no arrow) | `───` | Undirected / bidirectional |

### Edge Labels

```
[Source] -->|label text| [Target]
```

## DSL Syntax

### Flowchart

```
flowchart
  [Start] --> [Process A] --> {Decision?}
  {Decision?} -->|yes| [Path B]
  {Decision?} -->|no| [Path C]
  [Path B] --> [End]
  [Path C] --> [End]
```

### Architecture

```
architecture
  [Web Client] --> [API Gateway]
  [API Gateway] ==> [Auth Service]
  [API Gateway] ==> [Order Service]
  [Order Service] --> ((PostgreSQL))
  [Auth Service] -.-> ((Redis))
  [Order Service] --> [Notification Service]
```

### Bar Chart

```
barchart "API Response Times (ms)"
  Users API: 120
  Orders API: 340
  Search API: 580
  Auth API: 45
  Payment API: 890
```

### Tree / Hierarchy

Use architecture type with tree-like connections:

```
architecture
  [Root] --> [Child A]
  [Root] --> [Child B]
  [Child A] --> [Leaf 1]
  [Child A] --> [Leaf 2]
  [Child B] --> [Leaf 3]
```

## Best Practices

1. **Keep labels short** — 8-14 characters max. Long labels break layout.
   - ✅ `[Auth Service]` 
   - ❌ `[Authentication and Authorization Service]`

2. **Limit node count** — 6-10 nodes per graph. Split larger systems into sub-graphs.
   - ✅ One graph per microservice boundary
   - ❌ 25-node monolith diagram

3. **Use the right shape** — Consistent semantics make diagrams scannable.
   - `()` for users/external systems
   - `{}` for decisions/conditions only
   - `(( ))` for databases/storage only
   - `[]` for everything else

4. **Use edge styles with meaning** — Don't mix styles randomly.
   - `==>` for the happy/critical path
   - `-->` for standard connections
   - `-.->` for optional/async paths

5. **Label important edges** — Especially on decision branches.
   - `{Check Auth?} -->|authenticated| [Dashboard]`
   - `{Check Auth?} -->|unauthorized| [Login]`

6. **Bar chart values** — Keep value labels concise. Tool auto-scales bars.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Labels too long (>15 chars) | Abbreviate: `AuthSvc` instead of `Authentication Service` |
| Too many nodes (>12) | Split into separate diagrams |
| Circular edges (A→B→A) | Break cycle with a label: A→B→A' (different context) |
| Missing diagram type header | Always start with `flowchart`, `architecture`, or `barchart "Title"` |
| Mixing node shapes randomly | Use shapes with consistent meaning |
| Bar chart with too many items | Show top 5-8, group rest as "Other" |

## Examples

### User Login Flow

```
flowchart
  (User) --> [Login Page] --> [Submit Credentials]
  [Submit Credentials] --> {Valid?}
  {Valid?} -->|yes| [Generate Token] --> [Dashboard]
  {Valid?} -->|no| [Show Error] --> [Login Page]
```

### Microservices Architecture

```
architecture
  [Mobile App] --> [API Gateway]
  [Web App] --> [API Gateway]
  [API Gateway] ==> [User Service]
  [API Gateway] ==> [Order Service]
  [User Service] --> ((Users DB))
  [Order Service] --> ((Orders DB))
  [Order Service] -.-> [Cache]
```

### Sprint Velocity

```
barchart "Sprint Velocity (story points)"
  Sprint 1: 34
  Sprint 2: 42
  Sprint 3: 38
  Sprint 4: 51
  Sprint 5: 47
  Sprint 6: 55
```
