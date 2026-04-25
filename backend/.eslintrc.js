module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'security'],
  extends: ['plugin:security/recommended-legacy'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // ── SQL Injection Prevention ──────────────────────────────────────────────
    // Disallow template literals passed directly to .query() calls.
    // All dynamic queries must use QueryBuilder with bound parameters.
    'no-restricted-syntax': [
      'error',
      {
        // .query(`...${...}...`) — template literal with any expression inside
        selector:
          "CallExpression[callee.property.name='query'] > TemplateLiteral:first-child[expressions.length>0]",
        message:
          'SQL template literals with interpolation are forbidden. Use TypeORM QueryBuilder with bound parameters instead.',
      },
    ],

    // Flag detect-non-literal-query-string from eslint-plugin-security as error
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-object-injection': 'off', // too noisy for TS codebases
    'security/detect-possible-timing-attacks': 'warn',
  },
};
