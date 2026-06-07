#!/bin/sh

set -eu

NODE_VERSION="22.11.0"
JDK_VERSION="21"
ECLIPSE_VERSION="4.39"
ECLIPSE_DROP="R-4.39-202602260420"

log() {
    printf '[git-chord-eclipse-demo] %s\n' "$*"
}

fail() {
    printf '[git-chord-eclipse-demo] ERROR: %s\n' "$*" >&2
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
workspace_dir="${demo_dir}/workspace"
configuration_dir="${demo_dir}/configuration"
dropins_dir="${demo_dir}/dropins"
build_dir="${demo_dir}/build"

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
    require_command javac || return 1
    require_command jar || return 1

    host_java_major="$( java_major_version )"
    case "$host_java_major" in
        ''|*[!0-9]*) return 1 ;;
    esac

    [ "$host_java_major" -ge "$JDK_VERSION" ] 2>/dev/null
}

ensure_java() {
    if host_java_is_usable; then
        log "Using host Java: $( java -version 2>&1 | sed -n '1p' )"
        return
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

    if [ ! -x "${ensure_java_home}/bin/java" ] || [ ! -x "${ensure_java_home}/bin/javac" ]; then
        mkdir -p "$tools_dir" "$ensure_java_home"
        log "Installing local JDK ${JDK_VERSION} under ${ensure_java_home}."
        download "$ensure_java_url" "$ensure_java_archive"
        tar -xzf "$ensure_java_archive" -C "$ensure_java_home" --strip-components=1
    fi

    export JAVA_HOME="$ensure_java_home"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    log "Using Java: $( java -version 2>&1 | sed -n '1p' )"
}

host_eclipse_home() {
    if [ -n "${ECLIPSE_HOME:-}" ] && [ -x "${ECLIPSE_HOME}/eclipse" ] && [ -d "${ECLIPSE_HOME}/plugins" ]; then
        printf '%s\n' "$ECLIPSE_HOME"
        return 0
    fi

    if ! require_command eclipse; then
        return 1
    fi

    host_eclipse_command="$( command -v eclipse )"
    host_eclipse_dir="$( physical_dir "$( dirname "$host_eclipse_command" )" )" || return 1
    if [ -d "${host_eclipse_dir}/plugins" ]; then
        printf '%s\n' "$host_eclipse_dir"
        return 0
    fi

    return 1
}

ensure_eclipse() {
    if eclipse_home="$( host_eclipse_home )"; then
        ECLIPSE_HOME="$eclipse_home"
        ECLIPSE_COMMAND="${ECLIPSE_HOME}/eclipse"
        log "Using host Eclipse under ${ECLIPSE_HOME}."
        return
    fi

    ensure_eclipse_machine="$( uname -m )"
    case "$ensure_eclipse_machine" in
        x86_64|amd64) ensure_eclipse_arch="x86_64" ;;
        aarch64|arm64) ensure_eclipse_arch="aarch64" ;;
        ppc64le) ensure_eclipse_arch="ppc64le" ;;
        riscv64) ensure_eclipse_arch="riscv64" ;;
        *) fail "Unsupported CPU architecture for automatic Eclipse bootstrap: ${ensure_eclipse_machine}" ;;
    esac

    ensure_eclipse_name="eclipse-platform-${ECLIPSE_VERSION}-linux-gtk-${ensure_eclipse_arch}"
    ensure_eclipse_home="${tools_dir}/${ensure_eclipse_name}/eclipse"
    ensure_eclipse_archive="${tools_dir}/${ensure_eclipse_name}.tar.gz"
    ensure_eclipse_url="https://download.eclipse.org/eclipse/downloads/drops4/${ECLIPSE_DROP}/${ensure_eclipse_name}.tar.gz"

    if [ ! -x "${ensure_eclipse_home}/eclipse" ] || [ ! -d "${ensure_eclipse_home}/plugins" ]; then
        mkdir -p "$tools_dir" "${tools_dir}/${ensure_eclipse_name}"
        log "Installing local Eclipse Platform ${ECLIPSE_VERSION} under ${tools_dir}."
        download "$ensure_eclipse_url" "$ensure_eclipse_archive"
        tar -xzf "$ensure_eclipse_archive" -C "${tools_dir}/${ensure_eclipse_name}"
    fi

    ECLIPSE_HOME="$ensure_eclipse_home"
    ECLIPSE_COMMAND="${ECLIPSE_HOME}/eclipse"
    log "Using local Eclipse under ${ECLIPSE_HOME}."
}

build_web_bundle() {
    log "Building core package and Eclipse web bundle."
    ( cd "$script_dir" && ./build.sh )
}

copy_source_resources() {
    source_root="$1"
    classes_dir="$2"

    ( cd "$source_root" && find . -type f ! -name '*.java' ) | while IFS= read -r resource; do
        target_dir="${classes_dir}/$( dirname "$resource" )"
        mkdir -p "$target_dir"
        cp "${source_root}/${resource}" "${classes_dir}/${resource}"
    done
}

package_plugin() {
    plugin_build_dir="${build_dir}/plugin"
    classes_dir="${plugin_build_dir}/classes"
    sources_file="${plugin_build_dir}/sources.txt"
    plugin_jar="${dropins_dir}/plugins/git-chord-gui-eclipse_0.1.0.snapshot.jar"

    rm -rf "$plugin_build_dir"
    mkdir -p "$classes_dir" "${dropins_dir}/plugins"

    find "${script_dir}/src" -name '*.java' | sort > "$sources_file"

    log "Compiling Eclipse plugin Java classes."
    javac --release 17 \
        -cp "${ECLIPSE_HOME}/plugins/*" \
        -d "$classes_dir" \
        @"$sources_file"

    copy_source_resources "${script_dir}/src" "$classes_dir"
    cp "${script_dir}/plugin.xml" "$classes_dir/plugin.xml"
    mkdir -p "${classes_dir}/META-INF"
    cp "${script_dir}/META-INF/MANIFEST.MF" "${classes_dir}/META-INF/MANIFEST.MF"
    cp -R "${script_dir}/icons" "${classes_dir}/icons"

    rm -f "$plugin_jar"
    ( cd "$classes_dir" && jar cfm "$plugin_jar" META-INF/MANIFEST.MF . )
    log "Packaged plugin: ${plugin_jar}"
}

run_eclipse() {
    mkdir -p "$workspace_dir" "$configuration_dir"
    java_executable="${JAVA_HOME:-}/bin/java"
    if [ ! -x "$java_executable" ]; then
        java_executable="$( command -v java )"
    fi

    log "Launching Eclipse for ${demo_context_dir}."
    exec "$ECLIPSE_COMMAND" \
        -nosplash \
        -clean \
        -data "$workspace_dir" \
        -configuration "$configuration_dir" \
        -consoleLog \
        -vm "$java_executable" \
        -vmargs \
        "-Dorg.eclipse.equinox.p2.reconciler.dropins.directory=${dropins_dir}" \
        "-DgitChord.commandPath=${cli_path}" \
        "-DgitChord.openOnStartup=true" \
        "-DgitChord.contextDirectory=${demo_context_dir}"
}

if [ ! -x "$cli_path" ]; then
    fail "Git Chord CLI executable not found: ${cli_path}"
fi

mkdir -p "$demo_dir"
ensure_node
ensure_java
ensure_eclipse
build_web_bundle
package_plugin

if [ "${GIT_CHORD_DEMO_BUILD_ONLY:-}" = "1" ]; then
    log "Build-only mode complete."
    exit 0
fi

run_eclipse
