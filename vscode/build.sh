#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
cd "$projectDir"

npm install ../core/package-dist/git-chord-gui-core-*.tgz

cd "$startDir"
