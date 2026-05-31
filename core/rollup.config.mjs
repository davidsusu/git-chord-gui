// rollup.config.js
import terser from '@rollup/plugin-terser';
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import postcss from "rollup-plugin-postcss";
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

function onwarn(warning, warn) {
	if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.id?.includes("node_modules/@radix-ui/")) {
		return;
	}
	warn(warning);
}

export default [
	{
		input: 'src/index.ts',
		onwarn,
		output: [
			{
				file: pkg.main,
				format: 'cjs',
				sourcemap: true,
			},
			{
				file: pkg.module,
				format: "esm",
				sourcemap: true,
			},
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
			typescript({ tsconfig: "./tsconfig.json" }),
			postcss(),
			terser()
		]
	},
	{
		input: "dist/esm/types/index.d.ts",
		output: [{ file: "dist/index.d.ts", format: "esm" }],
		plugins: [dts()],
		external: [/\.(css|less|scss)$/],
	},
];
