# SiteSync PM Platform: Setup Guide

## Step 1: Install Claude Code (if you don't have it)

Open your terminal and run:
```bash
npm install -g @anthropic-ai/claude-code
```

## Step 2: Create GitHub Repository

Go to github.com and create a new repository:
- Name: `sitesync-pm`
- Description: SiteSync AI Construction Project Management Platform
- Private repository (recommended)
- Do NOT initialize with README (we already have one)

## Step 3: Copy the Project to Your Machine

The full project is in your SiteSync AI folder under `sitesync-pm/`.
Copy that entire folder to wherever you keep your projects, for example:

```bash
cp -r "~/path/to/SiteSync ai/sitesync-pm" ~/projects/sitesync-pm
```

## Step 4: Initialize Git and Push

```bash
cd ~/projects/sitesync-pm

# Remove the sandbox git folder if it exists
rm -rf .git

# Start fresh
git init
git checkout -b main
git add -A
git commit -m "Initial scaffold: SiteSync AI Construction PM Platform"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/sitesync-pm.git
git push -u origin main
```

## Step 5: Install Dependencies and Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. You should see the full platform.

## Step 6: Start Claude Code

```bash
cd ~/projects/sitesync-pm
claude
```

Claude Code will read the CLAUDE.md file and understand the entire project structure, brand guidelines, and next steps.

## What to Tell Claude Code

Here are some good first tasks:
- "Make the dashboard responsive for mobile"
- "Add a drawing viewer component with zoom and pan"
- "Implement a real RFI creation form with validation"
- "Add dark mode toggle"
- "Set up Zustand for state management"
- "Add Supabase for backend and authentication"

## Sharing with Saibby (Dev Team)

Once the repo is on GitHub:
1. Add Saibby as a collaborator in Settings > Collaborators
2. They can clone and run `npm install && npm run dev`
3. The CLAUDE.md file gives them full context on the architecture
4. Each page is its own file in `src/pages/` for easy parallel development
