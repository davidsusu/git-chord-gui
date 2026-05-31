#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
cd "$projectDir"

rm -f git-chord-gui-core-*.tgz
mkdir -p package-dist/
if [ ! -d node_modules ] || [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
    npm install --no-audit --no-fund
fi
npm run build &&
    npm pack &&
    mv git-chord-gui-core-*.tgz package-dist/ ;

cd "$startDir"
