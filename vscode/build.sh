#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
coreDir="$( realpath "${projectDir}/../core" )"

"$coreDir"/build.sh
cd "$projectDir"

if [ ! -d node_modules ] || [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
    npm install --no-audit --no-fund --legacy-peer-deps
fi
npm install --no-audit --no-fund --legacy-peer-deps ../core/package-dist/git-chord-gui-core-*.tgz
npm run compile-web

cd "$startDir"
