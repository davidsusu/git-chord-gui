#!/bin/sh

set -eu

NODE_VERSION="22.11.0"

log() {
    printf '[git-chord-web-demo] %s\n' "$*"
}

fail() {
    printf '[git-chord-web-demo] ERROR: %s\n' "$*" >&2
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
demo_dir="${script_dir}/.demo"
tools_dir="${demo_dir}/tools"

unset LD_LIBRARY_PATH

require_command() {
    command -v "$1" >/dev/null 2>&1
}

node_major_version() {
    node --version 2>/dev/null | sed 's/^[^0-9]*//; s/[^0-9].*$//'
}

host_node_is_usable() {
    require_command node || return 1
    require_command npm || return 1

    host_node_major="$( node_major_version )"
    [ "$host_node_major" -ge 20 ] 2>/dev/null
}

download() {
    download_url="$1"
    download_target="$2"

    if require_command curl; then
        curl -fL "$download_url" -o "$download_target"
    elif require_command wget; then
        wget -O "$download_target" "$download_url"
    else
        fail "Need curl or wget to download Node.js when node/npm are not installed."
    fi
}

ensure_node() {
    if [ "${GIT_CHORD_WEB_DEMO_USE_HOST_NODE:-}" = "1" ] && host_node_is_usable; then
        log "Using host Node.js $( node --version ) and npm $( npm --version )."
        return
    fi

    ensure_node_machine="$( uname -m )"
    case "$ensure_node_machine" in
        x86_64|amd64) ensure_node_arch="x64" ;;
        aarch64|arm64) ensure_node_arch="arm64" ;;
        *) fail "Unsupported CPU architecture for automatic Node.js bootstrap: ${ensure_node_machine}" ;;
    esac

    ensure_node_name="node-v${NODE_VERSION}-linux-${ensure_node_arch}"
    ensure_node_home="${tools_dir}/${ensure_node_name}"
    ensure_node_url="https://nodejs.org/dist/v${NODE_VERSION}/${ensure_node_name}.tar.xz"
    ensure_node_archive="${tools_dir}/${ensure_node_name}.tar.xz"

    for ensure_node_candidate in \
        "${ensure_node_home}" \
        "${gui_dir}/.demo/tools/${ensure_node_name}" \
        "${gui_dir}/vscode/.demo/tools/${ensure_node_name}"
    do
        if [ -x "${ensure_node_candidate}/bin/node" ] && [ -x "${ensure_node_candidate}/bin/npm" ]; then
            export PATH="${ensure_node_candidate}/bin:${PATH}"
            log "Using local Node.js $( node --version ) and npm $( npm --version )."
            return
        fi
    done

    if [ ! -x "${ensure_node_home}/bin/node" ] || [ ! -x "${ensure_node_home}/bin/npm" ]; then
        mkdir -p "$tools_dir"
        log "Installing local Node.js v${NODE_VERSION} under ${tools_dir}."
        download "$ensure_node_url" "$ensure_node_archive"
        tar -xJf "$ensure_node_archive" -C "$tools_dir"
    fi

    export PATH="${ensure_node_home}/bin:${PATH}"
    log "Using local Node.js $( node --version ) and npm $( npm --version )."
}

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

prepare_dependencies() {
    log "Building core package and preparing web dependencies."
    "$core_dir"/build.sh
    cd "$script_dir"
    if [ ! -d node_modules ] || [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
        npm install --no-audit --no-fund --legacy-peer-deps
    fi
    npm install --no-audit --no-fund --legacy-peer-deps ../core/package-dist/git-chord-gui-core-*.tgz
}

ensure_node
prepare_dependencies

if [ -x "$cli_path" ]; then
    export GIT_CHORD_COMMAND_PATH="${GIT_CHORD_COMMAND_PATH:-$cli_path}"
fi

if has_context_argument "$@"; then
    exec node "$script_dir/server.mjs" "$@"
fi

exec node "$script_dir/server.mjs" "$@" "$cli_repo_dir"
