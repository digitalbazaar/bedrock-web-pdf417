module.exports = {
  root: true,
  extends: ['digitalbazaar'],
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
  // this is required for dynamic import()
    ecmaVersion: 2020
  },
  ignorePatterns: ['node_modules']
};
