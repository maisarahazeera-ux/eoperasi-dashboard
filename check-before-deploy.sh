#!/usr/bin/env bash
# =====================================================================
#  e-Operasi : pre-deployment check
# ---------------------------------------------------------------------
#  Checks the whole project for errors BEFORE it goes to the Linux
#  server, so problems show up here instead of on the server.
#
#  What it checks:
#    1. Tools      - git, .NET 10 SDK, Node.js, npm are installed
#    2. Git        - uncommitted changes, branch in sync with GitHub
#    3. Secrets    - no passwords / teacher data / build output in Git
#    4. Linux      - import file names match the real file names
#                    (Windows ignores upper/lower case, Linux does NOT)
#    5. Frontend   - TypeScript type check + production build (Vite)
#    6. Backend    - .NET Release build (compile errors and warnings)
#    7. Database   - EF Core model changes that have no migration yet
#    8. Prod config- appsettings.Production.json (only if it exists,
#                    i.e. when the script is run on the server)
#
#  How to run (from the project folder, the one with .gitignore):
#      bash check-before-deploy.sh            # full check
#      bash check-before-deploy.sh --quick    # skip npm install / restore
#
#  Works on the Linux server, and on Windows with Git Bash.
#  Exit code 0 = OK to deploy, 1 = there are errors to fix first.
# =====================================================================

# Do not use "set -e": we want to run EVERY check and report all problems
# at the end, not stop at the first one.
set -u

# ---------------------------------------------------------------------
# Settings (change here if a folder is renamed)
# ---------------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # folder of this script
FRONTEND_DIR="$ROOT/e-Operasi prototype"                # React + Vite dashboard
API_DIR="$ROOT/EOperasiAPI"                             # ASP.NET Core API
API_PROJECT="$API_DIR/EOperasiApi.csproj"
REQUIRED_DOTNET_MAJOR=10                                # matches <TargetFramework>net10.0
MIN_NODE_MAJOR=20                                       # Vite 8 needs Node 20.19+ / 22.12+

QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

# Temporary folder for logs and the test build; removed when the script ends.
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t eoperasi)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------------
# Output helpers: coloured PASS / WARN / FAIL lines + counters
# ---------------------------------------------------------------------
if [[ -t 1 ]]; then
  RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BLUE=$'\e[34m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi

ERRORS=0
WARNINGS=0

section() { echo; echo "${BOLD}${BLUE}== $1 ==${RESET}"; }
pass()    { echo "  ${GREEN}[PASS]${RESET} $1"; }
warn()    { echo "  ${YELLOW}[WARN]${RESET} $1"; WARNINGS=$((WARNINGS + 1)); }
fail()    { echo "  ${RED}[FAIL]${RESET} $1"; ERRORS=$((ERRORS + 1)); }
info()    { echo "         $1"; }

# Print the last N lines of a log file, indented, so the real error is visible.
show_log() {
  local file="$1" lines="${2:-25}"
  tail -n "$lines" "$file" | sed 's/^/         | /'
}

has() { command -v "$1" >/dev/null 2>&1; }

cd "$ROOT" || { echo "Cannot open $ROOT"; exit 1; }
echo "${BOLD}e-Operasi pre-deployment check${RESET}"
echo "Project folder: $ROOT"
[[ $QUICK -eq 1 ]] && echo "(quick mode: skipping npm install and dotnet restore)"

# =====================================================================
# 1. TOOLS
# =====================================================================
section "1. Tools"

if has git; then pass "git $(git --version | awk '{print $3}')"; else fail "git is not installed"; fi

HAVE_DOTNET=0
if has dotnet; then
  # List installed SDKs and look for a 10.x one (the runtime alone cannot build).
  if dotnet --list-sdks 2>/dev/null | grep -q "^${REQUIRED_DOTNET_MAJOR}\."; then
    pass ".NET SDK $(dotnet --list-sdks | grep "^${REQUIRED_DOTNET_MAJOR}\." | tail -1 | awk '{print $1}')"
    HAVE_DOTNET=1
  else
    fail ".NET ${REQUIRED_DOTNET_MAJOR} SDK not found (installed: $(dotnet --list-sdks | awk '{print $1}' | tr '\n' ' '))"
    info "Ubuntu: sudo apt install dotnet-sdk-${REQUIRED_DOTNET_MAJOR}.0"
  fi
else
  fail "dotnet is not installed"
  info "Ubuntu: sudo apt install dotnet-sdk-${REQUIRED_DOTNET_MAJOR}.0"
fi

HAVE_NODE=0
if has node && has npm; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if (( NODE_MAJOR >= MIN_NODE_MAJOR )); then
    pass "Node.js $(node -v), npm $(npm -v)"
    HAVE_NODE=1
  else
    fail "Node.js $(node -v) is too old (need ${MIN_NODE_MAJOR}+ for Vite 8)"
  fi
else
  fail "Node.js / npm is not installed"
fi

# =====================================================================
# 2. GIT STATUS
# =====================================================================
section "2. Git"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  info "Branch: $BRANCH"

  # Files changed but not committed -> they will NOT reach the server via git pull.
  CHANGED="$(git status --porcelain)"
  if [[ -z "$CHANGED" ]]; then
    pass "No uncommitted changes"
  else
    warn "Uncommitted changes (commit + push them first):"
    echo "$CHANGED" | sed 's/^/         | /'
  fi

  # Compare with GitHub. "fetch" only downloads info, it does not change your files.
  if git fetch --quiet origin 2>/dev/null; then
    UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"
    if [[ -z "$UPSTREAM" ]]; then
      warn "Branch '$BRANCH' is not on GitHub yet  ->  git push -u origin $BRANCH"
    else
      read -r BEHIND AHEAD < <(git rev-list --left-right --count "$UPSTREAM...HEAD")
      if   (( AHEAD > 0 ));  then warn "$AHEAD commit(s) not pushed to $UPSTREAM yet  ->  git push"
      elif (( BEHIND > 0 )); then warn "$BEHIND new commit(s) on $UPSTREAM you do not have  ->  git pull"
      else pass "In sync with $UPSTREAM"; fi
    fi
  else
    warn "Could not reach GitHub (offline?) - skipped the sync check"
  fi
else
  warn "Not a git repository - skipped git checks"
fi

# =====================================================================
# 3. SECRETS & PERSONAL DATA (must never be in Git / on GitHub)
# =====================================================================
section "3. Secrets and personal data"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Patterns of files that should never be tracked. Matches .gitignore.
  #  - real config with passwords, teacher data (PDPA), uploads, build output
  BAD_FILES="$(git ls-files | grep -E \
      -e '(^|/)appsettings\.(Development|Production)\.json$' \
      -e '(^|/)\.env$' \
      -e '\.(xlsx|xls|csv)$' \
      -e 'sepadu.*\.txt$' \
      -e '^sepadu_data/|^data_export/' \
      -e '^EOperasiAPI/(uploads|bin|obj|wwwroot)/' \
      -e '(^|/)node_modules/' )"
  if [[ -z "$BAD_FILES" ]]; then
    pass "No secret / data / build files tracked by Git"
  else
    fail "These files are tracked by Git but must NOT be (remove with: git rm --cached <file>):"
    echo "$BAD_FILES" | sed 's/^/         | /'
  fi

  # Look for real-looking secrets inside tracked config files.
  # The example files use CHANGE_ME, so anything else long in Jwt Key / Password is suspicious.
  LEAKS="$(git grep -n -I -E '"(Key|Password)"\s*:\s*"[^"]{12,}"' -- '*.json' 2>/dev/null \
           | grep -v -E 'CHANGE_ME' )"
  if [[ -z "$LEAKS" ]]; then
    pass "No real passwords / JWT keys in tracked .json files"
  else
    fail "Possible password or key committed to Git:"
    echo "$LEAKS" | sed 's/^/         | /'
  fi
fi

# This script itself must have Linux (LF) line endings, or bash on the
# server fails with "$'\r': command not found".
if grep -q $'\r' "${BASH_SOURCE[0]}"; then
  fail "check-before-deploy.sh has Windows (CRLF) line endings - .gitattributes should fix this"
else
  pass "Script line endings are LF"
fi

# =====================================================================
# 4. LINUX FILE-NAME CASE CHECK
# ---------------------------------------------------------------------
# On Windows, import './Header' finds header.tsx. On Linux it does NOT,
# and the build or the page breaks only on the server. This small Node
# script resolves every relative import in src/ and compares the
# spelling with the real file name on disk, letter by letter.
# =====================================================================
section "4. Linux file-name case (imports)"

if (( HAVE_NODE )) && [[ -d "$FRONTEND_DIR/src" ]]; then
  cat > "$TMP_DIR/case-check.cjs" <<'NODE'
const fs = require('fs');
const path = require('path');
const srcDir = process.argv[2];
const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css',
              '/index.ts', '/index.tsx', '/index.js'];
const problems = [];

// Walk all source files.
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|css)$/.test(e.name)) checkFile(p);
  }
}

// True only if every part of the path exists with EXACTLY this spelling.
function existsExactCase(full) {
  const rel = path.relative(srcDir, full);
  if (rel.startsWith('..')) return fs.existsSync(full); // outside src: skip strict check
  let cur = srcDir;
  for (const part of rel.split(path.sep)) {
    if (!fs.existsSync(cur) || !fs.statSync(cur).isDirectory()) return false;
    if (!fs.readdirSync(cur).includes(part)) return false;
    cur = path.join(cur, part);
  }
  return true;
}

function checkFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  // import ... from 'x' | import 'x' | import('x') | url('x') in CSS
  const re = /(?:from\s+|import\s*\(?\s*|url\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) {
    let spec = m[1].split('?')[0];
    let base;
    if (spec.startsWith('./') || spec.startsWith('../')) base = path.resolve(path.dirname(file), spec);
    else if (spec.startsWith('@/')) base = path.join(srcDir, spec.slice(2));
    else continue; // npm package, http url, etc.
    const candidates = exts.map(e => base + e).filter(c => fs.existsSync(c) && fs.statSync(c).isFile());
    if (candidates.length === 0) {
      problems.push(`${path.relative(srcDir, file)}: import '${m[1]}' -> file not found`);
    } else if (!candidates.some(existsExactCase)) {
      problems.push(`${path.relative(srcDir, file)}: import '${m[1]}' -> wrong upper/lower case (works on Windows, FAILS on Linux)`);
    }
  }
}

walk(srcDir);
problems.forEach(p => console.log(p));
process.exit(problems.length ? 1 : 0);
NODE
  if CASE_OUT="$(node "$TMP_DIR/case-check.cjs" "$FRONTEND_DIR/src")"; then
    pass "All imports match the real file names"
  else
    fail "Import problems (fix the spelling in the import):"
    echo "$CASE_OUT" | sed 's/^/         | /'
  fi
else
  warn "Skipped (Node.js missing or src/ folder not found)"
fi

# =====================================================================
# 5. FRONTEND (React + TypeScript + Vite)
# =====================================================================
section "5. Frontend (e-Operasi prototype)"

if (( HAVE_NODE )) && [[ -f "$FRONTEND_DIR/package.json" ]]; then
  pushd "$FRONTEND_DIR" >/dev/null

  # 5a. Install packages exactly as in package-lock.json (same as the server will).
  NPM_OK=1
  if (( QUICK == 0 )) || [[ ! -d node_modules ]]; then
    if npm ci --no-audit --no-fund >"$TMP_DIR/npm.log" 2>&1; then
      pass "npm ci (packages installed from package-lock.json)"
    else
      NPM_OK=0
      if grep -qE 'EPERM|EBUSY|operation not permitted' "$TMP_DIR/npm.log"; then
        # Windows: a file inside node_modules is in use, so npm cannot delete it.
        fail "npm ci failed: a file in node_modules is LOCKED (not a code error)"
        info "Fix: stop 'npm run dev' (Ctrl+C in its terminal), pause OneDrive sync,"
        info "     then run this script again."
        grep -m1 'npm error path' "$TMP_DIR/npm.log" | sed 's/^/         | /'
      elif grep -qE 'EUSAGE|in sync|lock file' "$TMP_DIR/npm.log"; then
        fail "npm ci failed: package.json and package-lock.json do not match"
        info "Fix: run 'npm install' in the e-Operasi prototype folder and commit package-lock.json"
      else
        fail "npm ci failed:"
        show_log "$TMP_DIR/npm.log"
      fi
    fi
  fi

  # Without the packages, the type check and build cannot run, so skip them
  # instead of showing confusing follow-up errors.
  if (( NPM_OK == 0 )); then
    warn "Skipped TypeScript check and Vite build (packages not installed - fix 5a first)"
  else

  # 5b. TypeScript type check. Vite does NOT check types when building,
  #     so type errors would otherwise slip through silently.
  if npx --no-install tsc --noEmit -p . >"$TMP_DIR/tsc.log" 2>&1; then
    pass "TypeScript: no type errors"
  else
    TS_COUNT="$(grep -c 'error TS' "$TMP_DIR/tsc.log")"
    if (( TS_COUNT > 0 )); then
      fail "TypeScript: $TS_COUNT error(s)"
      grep 'error TS' "$TMP_DIR/tsc.log" | head -30 | sed 's/^/         | /'
    else
      # tsc did not even start (e.g. TypeScript not installed): show why.
      fail "TypeScript check could not run:"
      show_log "$TMP_DIR/tsc.log" 10
    fi
  fi

  # 5c. Production build, same mode as "npm run build:server" (uses .env.server),
  #     but written to a temp folder so your real wwwroot is not touched.
  if npx --no-install vite build --mode server --outDir "$TMP_DIR/wwwroot" --emptyOutDir \
       >"$TMP_DIR/vite.log" 2>&1; then
    if [[ -f "$TMP_DIR/wwwroot/index.html" ]]; then
      pass "Vite production build OK ($(du -sh "$TMP_DIR/wwwroot" | cut -f1))"
    else
      fail "Vite build finished but index.html is missing"
    fi
  else
    fail "Vite production build failed:"
    show_log "$TMP_DIR/vite.log" 30
  fi

  fi   # end of "packages installed" block (5b + 5c)

  # 5d. Leftover debugging code (warning only).
  DEBUG_LINES="$(grep -rn --include='*.ts' --include='*.tsx' -E '\bconsole\.log\(|\bdebugger\b' src | head -10)"
  if [[ -n "$DEBUG_LINES" ]]; then
    warn "console.log / debugger left in the code:"
    echo "$DEBUG_LINES" | sed 's/^/         | /'
  else
    pass "No console.log / debugger left"
  fi

  # 5e. Hard-coded localhost API address would break on the server.
  LOCALHOST_API="$(grep -rn --include='*.ts' --include='*.tsx' -E 'https?://(localhost|127\.0\.0\.1)' src | head -10)"
  if [[ -n "$LOCALHOST_API" ]]; then
    warn "Hard-coded localhost URL (fine only if it is a dev fallback):"
    echo "$LOCALHOST_API" | sed 's/^/         | /'
  fi

  popd >/dev/null
else
  warn "Skipped (Node.js missing or package.json not found)"
fi

# =====================================================================
# 6. BACKEND (ASP.NET Core API)
# =====================================================================
section "6. Backend (EOperasiAPI)"

if (( HAVE_DOTNET )) && [[ -f "$API_PROJECT" ]]; then
  # 6a. Download NuGet packages.
  RESTORE_OK=1
  if (( QUICK == 0 )); then
    if dotnet restore "$API_PROJECT" >"$TMP_DIR/restore.log" 2>&1; then
      pass "dotnet restore"
    else
      fail "dotnet restore failed:"
      show_log "$TMP_DIR/restore.log"
      RESTORE_OK=0
    fi
  fi

  # 6b. Release build, the same configuration as "dotnet publish -c Release".
  #     Output goes to the temp folder so bin/ is not touched.
  if (( RESTORE_OK )); then
    if dotnet build "$API_PROJECT" -c Release -o "$TMP_DIR/api-build" -nologo \
         >"$TMP_DIR/build.log" 2>&1; then
      # Count unique warnings (MSBuild prints each one twice).
      WARN_LIST="$(grep -E ': warning [A-Z]+[0-9]+' "$TMP_DIR/build.log" | sed 's/ \[.*\]$//' | sort -u)"
      WARN_COUNT="$(printf '%s' "$WARN_LIST" | grep -c . || true)"
      if (( WARN_COUNT == 0 )); then
        pass "dotnet build (Release): 0 errors, 0 warnings"
      else
        pass "dotnet build (Release): 0 errors"
        warn "$WARN_COUNT compiler warning(s) - not blocking, but worth a look:"
        echo "$WARN_LIST" | head -15 | sed "s|$ROOT/||; s/^/         | /"
      fi
    else
      fail "dotnet build failed:"
      grep -E ': error [A-Z]+[0-9]+' "$TMP_DIR/build.log" | sed 's/ \[.*\]$//' | sort -u | head -30 \
        | sed "s|$ROOT/||; s/^/         | /"
    fi
  fi

  # 6c. Windows-only code that breaks on Linux: back-slash paths or drive letters.
  WIN_PATHS="$(grep -rn --include='*.cs' --exclude-dir=bin --exclude-dir=obj --exclude-dir=Migrations \
                 -E '"[A-Za-z]:\\\\|"[^"]*[a-zA-Z0-9_]\\\\[a-zA-Z0-9_][^"]*\.(json|txt|png|jpg|html|csv|xlsx)"' "$API_DIR" | head -10)"
  if [[ -z "$WIN_PATHS" ]]; then
    pass "No Windows-style file paths (C:\\ or back-slashes) in C# code"
  else
    fail "Windows-style path found - use Path.Combine(...) instead:"
    echo "$WIN_PATHS" | sed "s|$ROOT/||; s/^/         | /"
  fi
else
  warn "Skipped (.NET SDK missing or EOperasiApi.csproj not found)"
fi

# =====================================================================
# 7. DATABASE MIGRATIONS
# ---------------------------------------------------------------------
# If a model class (Models/*.cs) was changed but no migration was added,
# the server database will not match the code and queries will crash.
# Needs the dotnet-ef tool:  dotnet tool install --global dotnet-ef
# =====================================================================
section "7. Database migrations"

if (( HAVE_DOTNET )) && dotnet ef --version >/dev/null 2>&1; then
  # The API refuses to start without a connection string and a 32+ char key
  # (see Program.cs), and the EF tool has to start it. Give it harmless dummy
  # values for THIS command only - nothing connects to a database here, and the
  # real settings checked in step 8 are not affected.
  if ConnectionStrings__Default="${ConnectionStrings__Default:-Host=localhost;Database=check;Username=check;Password=check}" \
     Jwt__Key="${Jwt__Key:-build-check-dummy-key-0123456789abcdef0123456789}" \
     ASPNETCORE_ENVIRONMENT=Development \
     dotnet ef migrations has-pending-model-changes --project "$API_PROJECT" \
       >"$TMP_DIR/ef.log" 2>&1; then
    pass "Models and migrations match (no missing migration)"
  else
    if grep -qi 'changes have been made to the model' "$TMP_DIR/ef.log"; then
      fail "Models changed but no migration was created  ->  dotnet ef migrations add <Name>"
    else
      warn "Could not check migrations:"
      show_log "$TMP_DIR/ef.log" 10
    fi
  fi
  info "Latest migration: $(ls "$API_DIR/Migrations" | grep -E '^[0-9]{14}_.*\.cs$' | grep -v Designer | sort | tail -1)"
else
  warn "dotnet-ef not installed - skipped (install: dotnet tool install --global dotnet-ef)"
fi

# =====================================================================
# 8. PRODUCTION SETTINGS (only when run on the server)
# ---------------------------------------------------------------------
# appsettings.Production.json only exists on the server (it is in
# .gitignore). If it is here, check that every CHANGE_ME was filled in.
# Values given as environment variables (Jwt__Key etc.) also count.
# =====================================================================
section "8. Production settings"

PROD_JSON="$API_DIR/appsettings.Production.json"
if [[ -f "$PROD_JSON" ]] && (( HAVE_NODE )); then
  # Node is used to read the JSON (the file may contain // comments, so strip them first).
  node - "$PROD_JSON" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
let cfg;
try {
  // Remove // comments that are not inside a string, then parse.
  cfg = JSON.parse(raw.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (m, str) => str ?? ''));
} catch (e) {
  console.log('FAIL|appsettings.Production.json is not valid JSON: ' + e.message);
  process.exit(0);
}
const env = process.env;
const get = (p, envName) => env[envName] ?? p.split(':').reduce((o, k) => (o ?? {})[k], cfg);
const out = (level, msg) => console.log(level + '|' + msg);

if (raw.includes('CHANGE_ME')) out('FAIL', 'Still contains CHANGE_ME - fill in every value');

const key = get('Jwt:Key', 'Jwt__Key') ?? '';
if (key.length < 32) out('FAIL', 'Jwt:Key is shorter than 32 characters');
else if (/temporary-dev-secret|CHANGE_ME/.test(key)) out('FAIL', 'Jwt:Key is still the development/example key');
else out('PASS', 'Jwt:Key looks OK');

const cs = get('ConnectionStrings:Default', 'ConnectionStrings__Default') ?? '';
if (!cs) out('FAIL', 'ConnectionStrings:Default is empty');
else if (/devpassword123/.test(cs)) out('FAIL', 'Database password is still the development one (devpassword123)');
else out('PASS', 'Database connection string is set');

const url = get('FrontendUrl', 'FrontendUrl') ?? '';
if (!url) out('FAIL', 'FrontendUrl is empty (email links will not work)');
else if (/localhost/.test(url)) out('WARN', 'FrontendUrl points to localhost: ' + url);
else if (!url.startsWith('https://')) out('WARN', 'FrontendUrl is not https: ' + url);
else out('PASS', 'FrontendUrl = ' + url);

if (!(cfg.Https && cfg.Https.Enabled === true)) out('WARN', 'Https:Enabled is false - turn it on once the certificate is installed');
if (!get('Smtp:Password', 'Smtp__Password')) out('WARN', 'Smtp:Password is empty - emails will not be sent');
NODE
  # (the Node output above is turned into PASS/WARN/FAIL lines below)
else
  info "appsettings.Production.json not found - normal on a developer PC, skipped."
  info "On the server, run this script again after creating it."
fi > "$TMP_DIR/prod.out"

while IFS='|' read -r level msg; do
  case "$level" in
    PASS) pass "$msg" ;;
    WARN) warn "$msg" ;;
    FAIL) fail "$msg" ;;
    *)    echo "$level" ;;   # plain info lines
  esac
done < "$TMP_DIR/prod.out"

# =====================================================================
# SUMMARY
# =====================================================================
echo
echo "${BOLD}=====================================================${RESET}"
if (( ERRORS > 0 )); then
  echo "${RED}${BOLD} NOT READY: $ERRORS error(s), $WARNINGS warning(s).${RESET}"
  echo " Fix the [FAIL] items above, then run this script again."
  echo "${BOLD}=====================================================${RESET}"
  exit 1
else
  echo "${GREEN}${BOLD} READY TO DEPLOY: 0 errors, $WARNINGS warning(s).${RESET}"
  (( WARNINGS > 0 )) && echo " Warnings do not block deployment, but read them."
  echo "${BOLD}=====================================================${RESET}"
  exit 0
fi
