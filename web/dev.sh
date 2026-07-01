#!/bin/sh

set -eu

log() {
    printf '[git-chord-web-dev] %s\n' "$*"
}

fail() {
    printf '[git-chord-web-dev] ERROR: %s\n' "$*" >&2
    exit 1
}

physical_dir() {
    (CDPATH=; cd -P "$1" >/dev/null 2>&1 && pwd -P)
}

case "$0" in
    */*) script_path="$0" ;;
    *) script_path="$( command -v "$0" )" || fail "Cannot resolve script path: $0" ;;
esac

script_dir="$( physical_dir "$( dirname "$script_path" )" )" || fail "Cannot resolve script directory."
gui_dir="$( physical_dir "${script_dir}/.." )" || fail "Cannot resolve GUI directory."
repo_root="$( physical_dir "${gui_dir}/.." )" || fail "Cannot resolve repository root."
core_dir="${gui_dir}/core"
cli_repo_dir="${repo_root}/git-chord"
cli_path="${cli_repo_dir}/bin/git-chord"
demo_context_dir="$gui_dir"

unset LD_LIBRARY_PATH

command -v node >/dev/null 2>&1 || fail "Need node on PATH. Use web/demo.sh for automatic Node bootstrap."
command -v npm >/dev/null 2>&1 || fail "Need npm on PATH. Use web/demo.sh for automatic Node bootstrap."

has_context_argument() {
    skip_next=0
    for arg in "$@"; do
        if [ "$skip_next" = "1" ]; then
            skip_next=0
            continue
        fi
        case "$arg" in
            -h|--help) return 0 ;;
            -p|--port) skip_next=1 ;;
            -*) ;;
            *) return 0 ;;
        esac
    done
    return 1
}

cleanup() {
    if [ "${core_watch_pid:-}" ]; then
        kill "$core_watch_pid" 2>/dev/null || true
        wait "$core_watch_pid" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

log "Building core once and preparing local package dependencies."
"$core_dir"/build.sh

cd "$script_dir"
if [ ! -d node_modules ] || [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
    npm install --no-audit --no-fund --legacy-peer-deps
fi
npm install --no-audit --no-fund --legacy-peer-deps --no-save --package-lock=false ../core

log "Starting core Rollup watcher."
( cd "$core_dir" && npm run dev ) &
core_watch_pid="$!"

if [ -x "$cli_path" ]; then
    export GIT_CHORD_COMMAND_PATH="${GIT_CHORD_COMMAND_PATH:-$cli_path}"
fi

if has_context_argument "$@"; then
    NODE_ENV=development node "$script_dir/server.mjs" "$@"
else
    NODE_ENV=development node "$script_dir/server.mjs" "$@" "$demo_context_dir"
fi
