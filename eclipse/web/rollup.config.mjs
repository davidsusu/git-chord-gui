// rollup.config.js
import terser from '@rollup/plugin-terser';
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import polyfillNode from 'rollup-plugin-polyfill-node';


export default [
	{
		input: 'src/index.tsx',
		output: [
			{
				file: 'dist/bundle.min.js',
				format: 'iife',
				name: 'version',
				plugins: [terser()]
			}
		],
		plugins: [
			peerDepsExternal(),
			resolve(),
			commonjs(),
			polyfillNode(),
			typescript({ tsconfig: "./tsconfig.json" }),
			postcss(),
			terser()
		]
	},
];
