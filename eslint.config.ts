// @ts-check
// Docs: https://eslint.org/docs/user-guide/configuring

import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'prettier.config.js',
      'tailwind.config.ts',
      'vite.config.ts',
      'dist',
      'e2e',
      'playwright-report',
      'test-results'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  prettierConfig
)
