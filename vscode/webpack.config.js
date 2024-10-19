//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');

/** @type WebpackConfig */
const webExtensionConfig = {
	mode: 'none',
	target: 'webworker',
	entry: {
		'extension': './src/web/extension.ts',
		'webview/index': './src/webview/index.tsx',
		'test/suite/index': './src/web/test/suite/index.ts'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './dist/web'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../../[resource-path]'
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'],
		extensions: ['.ts', '.tsx', '.js'],
		alias: {
		},
		fallback: {
			'assert': require.resolve('assert')
		}
	},
	module: {
		rules: [{
			test: /\.tsx?$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader'
			}]
		}]
	},
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1,
		}),
		new webpack.ProvidePlugin({
			process: 'process/browser',
		}),
	],
	externals: {
		'vscode': 'commonjs vscode',
	},
	performance: {
		hints: false
	},
	devtool: 'nosources-source-map',
	infrastructureLogging: {
		level: "log",
	},
};

module.exports = [ webExtensionConfig ];