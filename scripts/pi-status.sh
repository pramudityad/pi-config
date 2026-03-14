#!/bin/bash
# Quick status check for pi configuration

cd ~/git/pi-config

echo "=== Pi Configuration Status ==="
echo ""
echo "Location: $(pwd)"
echo "Linked to: $(readlink ~/.pi/agent)"
echo ""
echo "=== Git Status ==="
git status -sb
echo ""
echo "=== Recent Commits ==="
git log --oneline -5
echo ""
echo "=== Quick Commands ==="
echo "git diff          - See changes"
echo "git add -p        - Stage changes interactively"
echo "git commit -m ''  - Commit changes"
echo "git log           - View history"
