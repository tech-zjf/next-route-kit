import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

export default [
    {
        ignores: ['.next/**', 'next-env.d.ts'],
    },
    {
        plugins: {
            '@next/next': nextPlugin,
        },
        settings: {
            next: {
                rootDir: '.',
            },
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            '@next/next/no-html-link-for-pages': 'off',
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
    },
]
