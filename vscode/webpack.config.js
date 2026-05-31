//@ts-check
'use strict';

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');

const commonModuleRules = [{
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: [{
        loader: 'ts-loader',
        options: {
            onlyCompileBundledFiles: true,
        },
    }],
}];

/** @type WebpackConfig */
const extensionConfig = {
    mode: 'none',
    target: 'node',
    entry: {
        extension: './src/web/extension.ts',
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, './dist'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    resolve: {
        mainFields: ['module', 'main'],
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: commonModuleRules,
    },
    externals: {
        vscode: 'commonjs vscode',
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log',
    },
};

/** @type WebpackConfig */
const webviewConfig = {
    mode: 'none',
    target: 'web',
    entry: {
        'webview/index': './src/webview/index.tsx',
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, './dist'),
        devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        extensions: ['.ts', '.tsx', '.js'],
        fallback: {
            assert: require.resolve('assert'),
        },
    },
    module: {
        rules: commonModuleRules,
    },
    plugins: [
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1,
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
    ],
    performance: {
        hints: false,
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log',
    },
};

module.exports = [extensionConfig, webviewConfig];
