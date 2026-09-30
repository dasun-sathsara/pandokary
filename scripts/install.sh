#!/usr/bin/env bash
set -euo pipefail

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }

REPO_DIR="${1:-${PWD}}"
INSTALL_DIR="${2:-${HOME}/.local/bin}"

# Check dependencies
check_dep() {
  local name="$1" cmd="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    warn "$name is not installed. Please install it first."
    exit 1
  fi
}

check_dep "Git" "git"
check_dep "Go (>= 1.21)" "go"
check_dep "Pandoc" "pandoc"
check_dep "dprint" "dprint"

# Verify repo
if [ ! -f "$REPO_DIR/go.mod" ]; then
  echo "go.mod not found in $REPO_DIR. Confirm this is the pandokary repository." >&2
  exit 1
fi

# Resolve both paths from the caller's directory before the build changes cwd.
REPO_DIR="$(cd "$REPO_DIR" && pwd -P)"
mkdir -p "$INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd -P)"
info "Repo directory: $REPO_DIR"
info "Install directory: $INSTALL_DIR"

# Build
info "Building pdy..."
(cd "$REPO_DIR" && go build -o "$INSTALL_DIR/pdy" ./cmd/pdy)

info "Running smoke test..."
"$INSTALL_DIR/pdy" --help >/dev/null

# Add to PATH if not already present
if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  info "Adding $INSTALL_DIR to PATH..."
  SHELL_RC=""
  LOGIN_SHELL="${SHELL:-}"
  case "${LOGIN_SHELL##*/}" in
    zsh) SHELL_RC="${HOME}/.zshrc" ;;
    bash) SHELL_RC="${HOME}/.bashrc" ;;
  esac

  if [ -n "$SHELL_RC" ]; then
    # Quote the directory as shell data, including spaces, dollar signs and quotes.
    printf -v PATH_ENTRY 'export PATH=%q:"$PATH"' "$INSTALL_DIR"
    if [ ! -f "$SHELL_RC" ] || ! grep -Fqx -- "$PATH_ENTRY" "$SHELL_RC"; then
      printf '\n%s\n' "$PATH_ENTRY" >> "$SHELL_RC"
    fi
    info "Updated $SHELL_RC. Restart your shell or run:"
    info "  $PATH_ENTRY"
  else
    warn "Add $INSTALL_DIR to your shell's PATH to use pdy."
  fi
fi

echo ""
echo "pdy installation complete."
echo "Quick check: pdy --help"
