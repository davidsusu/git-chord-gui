#!/bin/sh

startDir="$( realpath "$( pwd )" )"

projectDir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"

cd "${projectDir}/web"
npm install
npm run build

cd "$projectDir"
rm -f 'src/hu/webarticum/gitchordgui/eclipse/views/index.js'
cp 'web/dist/bundle.min.js' 'src/hu/webarticum/gitchordgui/eclipse/views/index.js'

cd "$startDir"
