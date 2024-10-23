#!/bin/sh

startDir="$( realpath "$( pwd )" )"

rootDir="$( realpath "$( dirname -- "$( realpath "$0" )" )"/.. )"

"$rootDir"/core/build.sh
"$rootDir"/vscode/build.sh

cd "$startDir"
