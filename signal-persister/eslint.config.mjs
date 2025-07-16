import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs,ts}"],
		plugins: { js, prettier },
		extends: ["js/recommended"],
	},
	{
		files: ["**/*.{js,mjs,cjs,ts}"],
		languageOptions: { globals: globals.browser },
	},
	tseslint.configs.recommended,
	{
		rules: {
			"prettier/prettier": [
				"off",
				// Prettier config options
				{
					tabWidth: 2,
					useTabs: true,
					semi: true,
					singleQuote: false,
					endOfLine: "auto",
					printWidth: 200,
				},
			],
		},
	},
]);
