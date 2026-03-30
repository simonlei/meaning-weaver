// Minimal react-native mock for testing
const Platform = {
  OS: 'ios',
  select: jest.fn((obj) => obj.ios ?? obj.default),
};

const Alert = {
  alert: jest.fn(),
};

const StyleSheet = {
  create: (styles) => styles,
  hairlineWidth: 1,
  flatten: jest.fn((s) => s),
};

const Linking = {
  openURL: jest.fn().mockResolvedValue(undefined),
};

const Keyboard = {
  dismiss: jest.fn(),
};

const ActivityIndicator = 'ActivityIndicator';
const View = 'View';
const Text = 'Text';
const TextInput = 'TextInput';
const TouchableOpacity = 'TouchableOpacity';
const Image = 'Image';
const ScrollView = 'ScrollView';
const FlatList = 'FlatList';

module.exports = {
  Platform,
  Alert,
  StyleSheet,
  Linking,
  Keyboard,
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
};
