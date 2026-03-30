// Mock for expo-audio
const useAudioRecorder = jest.fn(() => ({
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  uri: 'file:///mock/audio/recording.m4a',
  isRecording: false,
}));

const useAudioRecorderState = jest.fn(() => ({
  isRecording: false,
  durationMillis: 0,
  metering: undefined,
}));

const useAudioPlayer = jest.fn(() => ({
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
  playing: false,
  currentTime: 0,
  duration: 0,
  status: 'idle',
}));

const useAudioPlayerStatus = jest.fn(() => ({
  playing: false,
  currentTime: 0,
  duration: 0,
}));

const requestRecordingPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, status: 'granted' });
const getRecordingPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, status: 'granted' });
const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const setIsAudioActiveAsync = jest.fn().mockResolvedValue(undefined);

const AudioQuality = {
  MIN: 0,
  LOW: 32,
  MEDIUM: 64,
  HIGH: 96,
  MAX: 127,
};

const IOSOutputFormat = {
  MPEG4AAC: 'aac',
  LINEARPCM: 'lpcm',
};

const RecordingPresets = {
  HIGH_QUALITY: {
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
    ios: { outputFormat: 'aac', audioQuality: 127 },
  },
  LOW_QUALITY: {
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 64000,
    android: { extension: '.3gp', outputFormat: '3gp', audioEncoder: 'amr_nb' },
    ios: { outputFormat: 'aac', audioQuality: 0 },
  },
};

module.exports = {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
};
