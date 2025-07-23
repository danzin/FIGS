import globals from "globals";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";

export default tseslint.config(
	// =================================================================
	// Global Ignores
	// =================================================================
	{
		ignores: [
			"**/node_modules/",
			"**/dist/",
			"**/build/",
			"**/*.config.js", // Ignore config files like vite.config.js, etc.
			"**/browser-profiles/",
		],
	},

	// =================================================================
	// Base Configuration for ALL Files
	// =================================================================
	{
		plugins: {
			"@typescript-eslint": tseslint.plugin,
			prettier: prettierPlugin,
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				project: true, // `true` tells it to find the nearest tsconfig.json, which will be the root one due to tsconfigRootDir
			},
			globals: {
				...globals.node, // Assume Node.js environment by default
			},
		},
		rules: {
			...tseslint.configs.recommended.rules,
			...tseslint.configs.stylistic.rules,
			...prettierConfig.rules, // Disables ESLint rules that conflict with Prettier
			"prettier/prettier": "warn",
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},

	// =================================================================
	// Overrides for the React Frontend
	// =================================================================
	{
		files: ["micro-frontend/src/**/*.{ts,tsx}"],
		plugins: {
			react: reactPlugin,
			"react-hooks": reactHooksPlugin,
			"jsx-a11y": jsxA11yPlugin,
		},
		languageOptions: {
			globals: {
				...globals.browser, // Frontend runs in the browser
			},
		},
		settings: {
			react: {
				version: "detect",
			},
		},
		rules: {
			...reactPlugin.configs.recommended.rules,
			...reactHooksPlugin.configs.recommended.rules,
			...jsxA11yPlugin.configs.recommended.rules,
			"react/react-in-jsx-scope": "off", // Not needed with Vite/modern React
		},
	},

	// =================================================================
	// Overrides for Backend Services (Node.js)
	// =================================================================
	{
		files: [
			"data-collector/src/**/*.ts",
			"signal-persister/src/**/*.ts",
			"signal-query-api/src/**/*.ts",
			"scraper-service/src/**/*.ts",
			"common/src/**/*.ts",
		],
		languageOptions: {
			globals: {
				...globals.node, // Explicitly Node.js environment
			},
		},
		rules: {},
	}
);
