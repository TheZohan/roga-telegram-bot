module.exports = {
    parser: '@typescript-eslint/parser',
    extends: [
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
      'prettier'
    ],
    plugins: ['@typescript-eslint', 'prettier'],
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    env: {
      node: true,
      jest: true,
    },
    rules: {
      // Add your custom rules here
      'prettier/prettier': 'error',
    },
  };
  