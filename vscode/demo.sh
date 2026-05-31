#!/bin/sh

set -eu

VSCODIUM_FLATPAK_ID="com.vscodium.codium"
MIN_VSCODIUM_VERSION="1.94.0"
NODE_VERSION="22.11.0"

log() {
    printf '[git-chord-demo] %s\n' "$*"
}

fail() {
    printf '[git-chord-demo] ERROR: %s\n' "$*" >&2
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

demo_dir="${script_dir}/.demo"
tools_dir="${demo_dir}/tools"
user_data_dir="${demo_dir}/user-data"
extensions_dir="${demo_dir}/extensions"

# Some Flatpak-launched editors leak their private libraries into child shells.
# That breaks host flatpak/node/git invocations, so keep this demo host-clean.
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

version_major() {
    printf '%s\n' "$1" | sed 's/^[^0-9]*//; s/[^0-9].*$//'
}

version_minor() {
    printf '%s\n' "$1" | sed 's/^[^0-9]*//; s/^[0-9][0-9]*//; s/^\.//; s/[^0-9].*$//'
}

version_is_supported() {
    version_actual="$1"

    [ -n "$version_actual" ] || return 1

    version_actual_major="$( version_major "$version_actual" )"
    version_actual_minor="$( version_minor "$version_actual" )"
    version_min_major="$( version_major "$MIN_VSCODIUM_VERSION" )"
    version_min_minor="$( version_minor "$MIN_VSCODIUM_VERSION" )"

    version_actual_minor="${version_actual_minor:-0}"
    version_min_minor="${version_min_minor:-0}"

    [ -n "$version_actual_major" ] || return 1
    [ -n "$version_min_major" ] || return 1

    case "${version_actual_major}${version_actual_minor}${version_min_major}${version_min_minor}" in
        *[!0-9]*|'') return 1 ;;
    esac

    [ "$version_actual_major" -gt "$version_min_major" ] ||
        { [ "$version_actual_major" -eq "$version_min_major" ] && [ "$version_actual_minor" -ge "$version_min_minor" ]; }
}

flatpak_app_installed() {
    require_command flatpak && flatpak info "$VSCODIUM_FLATPAK_ID" >/dev/null 2>&1
}

ensure_flatpak_vscodium() {
    if flatpak_app_installed; then
        return 0
    fi

    if ! require_command flatpak; then
        return 1
    fi

    log "Flatpak VSCodium is not installed; trying user-scope install from Flathub."
    flatpak install --user -y flathub "$VSCODIUM_FLATPAK_ID" || return 1
    flatpak_app_installed
}

flatpak_vscodium_version() {
    flatpak info "$VSCODIUM_FLATPAK_ID" 2>/dev/null |
        awk -F: '/Version:/ { gsub(/^[ \t]+/, "", $2); print $2; exit }'
}

host_vscodium_command() {
    if require_command codium; then
        printf '%s\n' "codium"
    elif require_command vscodium; then
        printf '%s\n' "vscodium"
    else
        return 1
    fi
}

host_vscodium_version() {
    "$1" --version 2>/dev/null | sed -n '1p'
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

prepare_demo_profile() {
    demo_settings_dir="${user_data_dir}/User"
    mkdir -p "$demo_settings_dir" "$extensions_dir"

    cat > "${demo_settings_dir}/settings.json" <<EOF
{
  "gitChord.commandPath": "$( json_escape "$cli_path" )",
  "gitChord.openOnStartup": true,
  "extensions.autoCheckUpdates": false,
  "extensions.autoUpdate": false,
  "telemetry.telemetryLevel": "off"
}
EOF
}

build_extension() {
    log "Building core package and VS Code extension bundle."
    ( cd "$script_dir" && ./build.sh )
}

run_flatpak_vscodium() {
    run_flatpak_version="$1"
    log "Launching Flatpak VSCodium ${run_flatpak_version}."
    exec flatpak run \
        --filesystem="${repo_root}" \
        --filesystem="${demo_dir}" \
        "$VSCODIUM_FLATPAK_ID" \
        --new-window \
        --user-data-dir "$user_data_dir" \
        --extensions-dir "$extensions_dir" \
        --extensionDevelopmentPath="$script_dir" \
        "$cli_repo_dir"
}

run_host_vscodium() {
    run_host_command_name="$1"
    run_host_version="$2"
    log "Launching host VSCodium ${run_host_version} via ${run_host_command_name}."
    exec "$run_host_command_name" \
        --new-window \
        --user-data-dir "$user_data_dir" \
        --extensions-dir "$extensions_dir" \
        --extensionDevelopmentPath="$script_dir" \
        "$cli_repo_dir"
}

if [ ! -x "$cli_path" ]; then
    fail "Git Chord CLI executable not found: ${cli_path}"
fi

mkdir -p "$demo_dir"
ensure_node
build_extension
prepare_demo_profile

if [ "${GIT_CHORD_DEMO_BUILD_ONLY:-}" = "1" ]; then
    log "Build-only mode complete."
    exit 0
fi

if ensure_flatpak_vscodium; then
    flatpak_version="$( flatpak_vscodium_version )"
    if version_is_supported "$flatpak_version"; then
        run_flatpak_vscodium "$flatpak_version"
    fi
    log "Flatpak VSCodium ${flatpak_version} is older than required ${MIN_VSCODIUM_VERSION}; trying host installation."
fi

if host_command="$( host_vscodium_command )"; then
    host_version="$( host_vscodium_version "$host_command" )"
    if version_is_supported "$host_version"; then
        run_host_vscodium "$host_command" "$host_version"
    fi
    fail "Host VSCodium ${host_version} is older than required ${MIN_VSCODIUM_VERSION}."
fi

fail "No usable VSCodium installation found. Install Flatpak VSCodium (${VSCODIUM_FLATPAK_ID}) or a host 'codium' executable."
