/* Minimal, low-friction lint config — catches real bugs (undefined vars, unreachable code,
   duplicate keys) without imposing a formatting style on the existing codebase. */
module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'uploads/**', '.claude/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      /* caughtErrors: 'none' — the codebase intentionally has dozens of best-effort cleanup
         catch blocks (e.g. `try { fs.unlinkSync(x) } catch(e) {}`) where the error is deliberately
         ignored. Flagging all of them would be pure noise, not a real bug signal. */
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-fallthrough': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
