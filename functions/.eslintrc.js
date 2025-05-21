module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    // Disable all rules that might cause problems
    "no-unused-vars": "off",
    "no-undef": "off",
  },
}; 