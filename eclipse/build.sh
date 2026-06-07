#!/bin/sh

set -eu

physical_dir() {
    (CDPATH=; cd -P "$1" >/dev/null 2>&1 && pwd -P)
}

case "$0" in
    */*) script_path="$0" ;;
    *) script_path="$( command -v "$0" )" ;;
esac

start_dir="$( physical_dir "$( pwd )" )"
project_dir="$( physical_dir "$( dirname "$script_path" )" )"
core_dir="$( physical_dir "${project_dir}/../core" )"

install_core_package() {
    core_package="$( find "${core_dir}/package-dist" -maxdepth 1 -name 'git-chord-gui-core-*.tgz' | sort | tail -n 1 )"
    if [ -z "$core_package" ]; then
        printf 'Git Chord core package was not found under %s\n' "${core_dir}/package-dist" >&2
        exit 1
    fi

    rm -rf 'node_modules/@git-chord/gui-core' 'node_modules/@git-chord/package'
    mkdir -p 'node_modules/@git-chord'
    tar -xzf "$core_package" -C 'node_modules/@git-chord'
    mv 'node_modules/@git-chord/package' 'node_modules/@git-chord/gui-core'
}

"$core_dir"/build.sh
cd "${project_dir}/web"
if [ ! -d node_modules ] ||
        [ ! -d node_modules/@radix-ui/react-scroll-area ] ||
        [ ! -d node_modules/@radix-ui/react-separator ] ||
        [ ! -d node_modules/@radix-ui/react-tooltip ] ||
        [ ! -d node_modules/highlight.js ] ||
        [ ! -d node_modules/immer ] ||
        [ ! -d node_modules/postcss ] ||
        [ ! -d node_modules/react-error-boundary ] ||
        [ ! -d node_modules/react-markdown ] ||
        [ ! -d node_modules/zustand ] ||
        [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
    npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
fi
install_core_package
npm run build

cd "$project_dir"
rm -f 'src/hu/webarticum/gitchordgui/eclipse/views/index.js'
cp 'web/dist/bundle.min.js' 'src/hu/webarticum/gitchordgui/eclipse/views/index.js'

cd "$start_dir"
