#!/bin/sh

set -eu

NODE_VERSION="22.11.0"
JDK_VERSION="17"
MAX_HOST_JAVA_VERSION="23"

log() {
    printf '[git-chord-intellij-demo] %s\n' "$*"
}

fail() {
    printf '[git-chord-intellij-demo] ERROR: %s\n' "$*" >&2
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
cli_repo_dir="${repo_root}/git-chord"
cli_path="${cli_repo_dir}/bin/git-chord"
demo_context_dir="$gui_dir"

demo_dir="${script_dir}/.demo"
tools_dir="${demo_dir}/tools"

# Some Flatpak-launched editors leak their private libraries into child shells.
# That breaks host node/git/gradle invocations, so keep this demo host-clean.
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
        fail "Need curl or wget to download required local tools."
    fi
}

ensure_node() {
    if host_node_is_usable; then
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

    if [ ! -x "${ensure_node_home}/bin/node" ] || [ ! -x "${ensure_node_home}/bin/npm" ]; then
        mkdir -p "$tools_dir"
        log "Installing local Node.js v${NODE_VERSION} under ${tools_dir}."
        download "$ensure_node_url" "$ensure_node_archive"
        tar -xJf "$ensure_node_archive" -C "$tools_dir"
    fi

    export PATH="${ensure_node_home}/bin:${PATH}"
    log "Using local Node.js $( node --version ) and npm $( npm --version )."
}

java_major_version() {
    java -version 2>&1 |
        sed -n '1s/.*version "\([0-9][0-9]*\).*/\1/p; 1s/.*version "1\.\([0-9][0-9]*\).*/\1/p'
}

host_java_is_usable() {
    require_command java || return 1

    host_java_major="$( java_major_version )"
    case "$host_java_major" in
        ''|*[!0-9]*) return 1 ;;
    esac

    [ "$host_java_major" -ge "$JDK_VERSION" ] 2>/dev/null &&
        [ "$host_java_major" -le "$MAX_HOST_JAVA_VERSION" ] 2>/dev/null
}

ensure_java() {
    if host_java_is_usable; then
        log "Using host Java: $( java -version 2>&1 | sed -n '1p' )"
        return
    fi

    if require_command java; then
        detected_java_major="$( java_major_version )"
        log "Host Java ${detected_java_major:-unknown} is outside supported range ${JDK_VERSION}-${MAX_HOST_JAVA_VERSION}; using local JDK ${JDK_VERSION}."
    fi

    ensure_java_machine="$( uname -m )"
    case "$ensure_java_machine" in
        x86_64|amd64) ensure_java_arch="x64" ;;
        aarch64|arm64) ensure_java_arch="aarch64" ;;
        *) fail "Unsupported CPU architecture for automatic JDK bootstrap: ${ensure_java_machine}" ;;
    esac

    ensure_java_home="${tools_dir}/jdk-${JDK_VERSION}-linux-${ensure_java_arch}"
    ensure_java_archive="${tools_dir}/jdk-${JDK_VERSION}-linux-${ensure_java_arch}.tar.gz"
    ensure_java_url="https://api.adoptium.net/v3/binary/latest/${JDK_VERSION}/ga/linux/${ensure_java_arch}/jdk/hotspot/normal/eclipse"

    if [ ! -x "${ensure_java_home}/bin/java" ]; then
        mkdir -p "$tools_dir" "$ensure_java_home"
        log "Installing local JDK ${JDK_VERSION} under ${ensure_java_home}."
        download "$ensure_java_url" "$ensure_java_archive"
        tar -xzf "$ensure_java_archive" -C "$ensure_java_home" --strip-components=1
    fi

    export JAVA_HOME="$ensure_java_home"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    log "Using Java: $( java -version 2>&1 | sed -n '1p' )"
}

build_extension() {
    log "Building core package and IntelliJ web bundle."
    ( cd "$script_dir" && ./build.sh )
}

run_intellij() {
    log "Launching IntelliJ Platform dev instance for ${demo_context_dir}."
    exec "$script_dir/gradlew" \
        -p "$script_dir" \
        runIde \
        "-PgitChordDemoProjectPath=${demo_context_dir}" \
        "-PgitChordCommandPath=${cli_path}"
}

if [ ! -x "$cli_path" ]; then
    fail "Git Chord CLI executable not found: ${cli_path}"
fi

mkdir -p "$demo_dir"
ensure_node
ensure_java
build_extension

if [ "${GIT_CHORD_DEMO_BUILD_ONLY:-}" = "1" ]; then
    log "Build-only mode complete."
    exit 0
fi

run_intellij
