
// Importer les "matchers" étendus de jest-native
import '@testing-library/jest-native/extend-expect';

// Mock pour react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
