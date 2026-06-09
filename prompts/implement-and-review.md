---
description: Worker implements, reviewer reviews in a loop until approved
---
Use the subagent tool in review mode:

- implementer: "worker"
- reviewer: "reviewer"
- task: $@
- maxIterations: 3
- scratchpad: true

Run review mode and report the final outcome.
