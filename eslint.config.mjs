import eslint from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.turbo/**', '**/.next/**', '**/next-env.d.ts'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs}'],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            // Factory intentionally merges a callable interface into its class.
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
        },
    },
    {
        files: ['apps/next15-fixture/**/*.{ts,tsx}', 'apps/next16-fixture/**/*.{ts,tsx}'],
        plugins: {
            '@next/next': nextPlugin,
        },
        settings: {
            next: {
                rootDir: ['apps/next15-fixture', 'apps/next16-fixture'],
            },
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
        },
    },
)
