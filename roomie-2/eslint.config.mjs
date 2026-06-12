import { FlatCompat } from '@eslint/eslintrc'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

const config = [
  {
    ignores: [
      '**/.next/**',
      '**/.vercel/**',
      '**/.claude/**',
      '**/node_modules/**',
      '**/public/assets/**',
      '**/docs/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default config
