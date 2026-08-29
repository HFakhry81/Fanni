/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx)",
    "**/*.(test|spec).(ts|tsx)",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
  collectCoverageFrom: [
    "utils/**/*.{ts,tsx}",
    "context/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
