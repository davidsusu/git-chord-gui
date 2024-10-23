#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
cd "$projectDir"

rm -f git-chord-gui-core-*.tgz
mkdir -p package-dist/
npm install &&
    npm run build &&
    npm pack &&
    mv git-chord-gui-core-*.tgz package-dist/ ;

cd "$startDir"
