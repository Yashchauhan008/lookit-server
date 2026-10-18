import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'], plugins: { js }, extends: ['js/recommended'], languageOptions: { globals: globals.browser }
    },
    tseslint.configs.recommended,
    prettier,
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
    },
    {
        rules: {
            'no-console': 0,
            camelcase: 0,
            'no-underscore-dangle': 0,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: 'next' },
            ],
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                { variables: false },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-multi-str': 0,
            'max-len': 'off',
            'import/no-unresolved': 'off',
            'import/extensions': 'off',
            'padded-blocks': 'off',

            // 'object-curly-spacing': ['error', 'always'],
            // 'object-curly-newline': ['error', {
            //     ObjectExpression: { minProperties: 4, multiline: true, consistent: true },
            //     ObjectPattern: { minProperties: 4, multiline: true, consistent: true },
            //     ImportDeclaration: { minProperties: 4, multiline: true, consistent: true },
            //     ExportDeclaration: { minProperties: 4, multiline: true, consistent: true },
            // }],

            'object-property-newline': ['error', {
                allowAllPropertiesOnSameLine: true,
            }],

            // 'indent': ['error', 4, {
            //     'SwitchCase': 1,
            //     'FunctionDeclaration': { 'parameters': 1 },
            //     'FunctionExpression': { 'parameters': 1 },
            //     'CallExpression': { 'arguments': 1 }
            // }],

            'no-multiple-empty-lines': ['error', {
                'max': 3,
                'maxEOF': 1,
                'maxBOF': 0
            }],

            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'comma-spacing': ['error', { 'before': false, 'after': true }],
        },
    },
]);
