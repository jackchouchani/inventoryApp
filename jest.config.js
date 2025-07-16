module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {
    '^.+\.([jt]sx?)$': 'babel-jest',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/r2-upload-worker/',
    '<rootDir>/r2-invoice-worker/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  testEnvironment: 'jsdom',
};