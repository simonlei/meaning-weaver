// Mock for expo-image-picker
const launchImageLibraryAsync = jest.fn().mockResolvedValue({
  canceled: true,
  assets: null,
});

const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  granted: true,
});

const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
};

module.exports = {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
};
