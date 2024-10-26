#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"

cd "${projectDir}/web"
npm install
npm run build

cd "$projectDir"
rm -f 'src/main/resources/webview/index.js'
cp 'web/dist/bundle.min.js' 'src/main/resources/webview/index.js'

cd "$startDir"
