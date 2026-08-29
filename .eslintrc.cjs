/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: [
    "node_modules/",
    "**/dist/",
    "**/dist-web/",
    "**/build/",
    "**/.expo/",
    "**/coverage/",
    "pnpm-lock.yaml",
    "artifacts/api-server/migrations/**",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      },
    ],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-useless-escape": "warn",
    "no-empty": "warn",
  },
  overrides: [
    {
      files: ["artifacts/mobile/**/*.{ts,tsx}"],
      plugins: ["react-native"],
      rules: {
        "react-native/no-inline-styles": "off",
        "react-native/no-raw-text": "off",
        "react-native/split-platform-components": "off",
      },
    },
    {
      files: ["artifacts/api-server/**/*.ts", "lib/**/*.ts", "scripts/**/*.ts"],
      env: { node: true },
      rules: {
        "react-hooks/rules-of-hooks": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-empty-object-type": "off",
      },
    },
    {
      files: ["**/*.{test,spec}.{ts,tsx}"],
      env: { jest: true },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
