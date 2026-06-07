#!/bin/sh

set -eu

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
coreDir="$( realpath "${projectDir}/../core" )"

install_core_package() {
    corePackage="$( find "${coreDir}/package-dist" -maxdepth 1 -name 'git-chord-gui-core-*.tgz' | sort | tail -n 1 )"
    [ -n "$corePackage" ] || {
        printf 'Git Chord core package was not found under %s\n' "${coreDir}/package-dist" >&2
        exit 1
    }

    rm -rf 'node_modules/@git-chord/gui-core' 'node_modules/@git-chord/package'
    mkdir -p 'node_modules/@git-chord'
    tar -xzf "$corePackage" -C 'node_modules/@git-chord'
    mv 'node_modules/@git-chord/package' 'node_modules/@git-chord/gui-core'
}

"$coreDir"/build.sh
cd "${projectDir}/web"
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

cd "$projectDir"
rm -f 'src/main/resources/webview/index.js'
cp 'web/dist/bundle.min.js' 'src/main/resources/webview/index.js'

cd "$startDir"
