#!/usr/bin/env bash
set -euo pipefail

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }

REPO_DIR="${1:-${PWD}}"
INSTALL_DIR="${2:-${HOME}/.local/bin}"

info "Repo directory: $REPO_DIR"
info "Install directory: $INSTALL_DIR"

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

# Build
info "Building pdy..."
mkdir -p "$INSTALL_DIR"
(cd "$REPO_DIR" && go build -o "$INSTALL_DIR/pdy" ./cmd/pdy)

info "Running smoke test..."
"$INSTALL_DIR/pdy" --help >/dev/null

# Add to PATH if not already present
if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  info "Adding $INSTALL_DIR to PATH..."
  SHELL_RC=""
  if [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "zsh" ]; then
    SHELL_RC="${HOME}/.zshrc"
  elif [ -n "${BASH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "bash" ]; then
    SHELL_RC="${HOME}/.bashrc"
  elif [ -f "${HOME}/.bash_profile" ]; then
    SHELL_RC="${HOME}/.bash_profile"
  fi

  if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
    echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$SHELL_RC"
    info "Updated $SHELL_RC. Restart your shell or run:"
    info "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  fi
fi

echo ""
echo "pdy installation complete."
echo "Quick check: pdy --help"
