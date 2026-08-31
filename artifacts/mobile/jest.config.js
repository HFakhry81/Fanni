/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.env.js"],
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx)",
    "**/*.(test|spec).(ts|tsx)",
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      { presets: ["babel-preset-expo"] },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-native$": "<rootDir>/jest.mocks/react-native.js",
    "^expo-constants$": "<rootDir>/jest.mocks/expo-constants.js",
    "^expo/virtual/env$": "<rootDir>/jest.mocks/expo-virtual-env.js",
  },
  collectCoverageFrom: [
    "utils/**/*.{ts,tsx}",
    "context/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
