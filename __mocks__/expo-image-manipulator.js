// Mock for expo-image-manipulator
const manipulateAsync = jest.fn().mockResolvedValue({
  uri: 'file:///mock/compressed/photo.jpg',
  width: 1280,
  height: 720,
});

const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
};

module.exports = {
  manipulateAsync,
  SaveFormat,
};
