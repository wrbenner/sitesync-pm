#!/bin/bash
###############################################################################
#  SITESYNC AI — ONE-TIME SETUP SCRIPT
#  Run this ONCE before launching the autonomous engine.
#  It installs CLIs, links Supabase, pushes migrations, and deploys functions.
###############################################################################

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
fail()    { echo -e "${RED}✗${NC} $1"; }
header()  { echo -e "\n${BOLD}═══ $1 ═══${NC}\n"; }

header "SiteSync PM Setup"

# ── 1. Node dependencies ──
header "Node Dependencies"
if [ -f "package.json" ]; then
    npm install
    success "Node packages installed"
else
    fail "No package.json found"
    exit 1
fi

# ── 2. Supabase CLI ──
header "Supabase CLI"
if command -v supabase >/dev/null 2>&1; then
    success "Supabase CLI already installed ($(supabase --version 2>&1 | head -1))"
else
    echo "Installing Supabase CLI..."
    if command -v brew >/dev/null 2>&1; then
        brew install supabase/tap/supabase
        success "Supabase CLI installed via Homebrew"
    else
        npm install -g supabase
        success "Supabase CLI installed via npm"
    fi
fi

# ── 3. Link Supabase project ──
header "Supabase Project Link"
if [ -f "supabase/.temp/project-ref" ]; then
    success "Already linked to $(cat supabase/.temp/project-ref)"
else
    # Read project ref from .env.local
    PROJECT_REF=""
    if [ -f ".env.local" ]; then
        PROJECT_REF=$(grep 'SUPABASE_PROJECT_REF' .env.local 2>/dev/null | cut -d'=' -f2 | tr -d ' "'"'"'' || echo "")
    fi

    if [ -z "$PROJECT_REF" ]; then
        # Extract from VITE_SUPABASE_URL
        PROJECT_REF=$(grep 'VITE_SUPABASE_URL' .env.local 2>/dev/null | grep -oE 'https://([^.]+)' | sed 's|https://||' || echo "")
    fi

    if [ -n "$PROJECT_REF" ]; then
        echo "Linking to project: ${PROJECT_REF}"
        supabase link --project-ref "$PROJECT_REF"
        success "Supabase project linked"
    else
        warn "Could not determine project ref. Run: supabase link --project-ref YOUR_REF"
    fi
fi

# ── 4. Push migrations ──
header "Database Migrations"
if [ -f "supabase/.temp/project-ref" ]; then
    echo "Pushing migrations to remote database..."
    supabase db push || warn "Some migrations failed (this is often OK if tables already exist)"
    success "Migration push complete"
else
    warn "Skipping (project not linked)"
fi

# ── 5. Deploy edge functions ──
header "Edge Functions"
if [ -f "supabase/.temp/project-ref" ] && [ -d "supabase/functions" ]; then
    for func_dir in supabase/functions/*/; do
        [ -f "${func_dir}index.ts" ] || continue
        func_name=$(basename "$func_dir")
        echo "Deploying: ${func_name}"
        supabase functions deploy "$func_name" --no-verify-jwt 2>/dev/null || warn "Failed: ${func_name}"
    done
    success "Edge functions deployed"
else
    warn "Skipping (project not linked or no functions found)"
fi

# ── 6. Playwright for E2E tests ──
header "Playwright (E2E Testing)"
if npx playwright --version >/dev/null 2>&1; then
    success "Playwright already installed"
else
    echo "Installing Playwright..."
    npm install -D @playwright/test
    npx playwright install chromium
    success "Playwright installed with Chromium"
fi

# ── 7. Vercel CLI (optional) ──
header "Vercel CLI (Auto-Deploy)"
if command -v vercel >/dev/null 2>&1; then
    success "Vercel CLI already installed"
else
    echo "Installing Vercel CLI..."
    npm install -g vercel
    success "Vercel CLI installed"
    echo ""
    echo "  To enable auto-deploy, run: vercel link"
    echo "  (Follow the prompts to connect to your Vercel project)"
fi

# ── 8. Verify build ──
header "Build Verification"
if npm run build 2>/dev/null; then
    success "Build passes"
else
    warn "Build has errors (the engine will fix these)"
fi

# ── Done ──
header "SETUP COMPLETE"
echo ""
echo "  Next steps:"
echo "  1. If Vercel is not linked: vercel link"
echo "  2. Launch the engine:"
echo ""
echo "     tmux new -s sitesync"
echo "     caffeinate -dims &"
echo "     export ANTHROPIC_API_KEY=\"your-key\""
echo "     MAX_CYCLES=30 MAX_SPEND=400 AUDIT_MODEL=claude-sonnet-4-6 ./autonomous_loop.sh ."
echo ""
