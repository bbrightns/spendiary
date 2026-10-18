import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'scratch', 'supabase'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // console.log can leak emails, tokens and payloads into the browser console; warn/error stay allowed
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Shared code sits below the feature modules: lib/, hooks/ and components/ never import
    // from modules/ (the app shell in src/app/ is where Spend and Invest meet)
    files: ['src/lib/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/modules/**'], message: 'lib/, hooks/ and components/ must not import from modules/. Move the shared piece down, or put the code in src/app/.' }],
      }],
    },
  },
  {
    // Ambient declarations for third-party globals
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
