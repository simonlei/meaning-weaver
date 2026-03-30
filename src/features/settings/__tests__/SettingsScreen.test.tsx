/**
 * TDD: SettingsScreen UI
 *
 * 策略：mock useApiKey 和 useSaveApiKey，测试 UI 交互契约
 * - 展示脱敏的已保存 key
 * - 输入 + 保存按钮调用 mutate
 * - 清除按钮调用 mutate('')
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { maskApiKey, SettingsScreen } from '../SettingsScreen';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockMutate = jest.fn();
const mockSaveApiKey = { mutate: mockMutate, isPending: false };
const mockUseApiKey = jest.fn();
const mockUseSaveApiKey = jest.fn();
const mockUseAsrCredentials = jest.fn();
const mockUseSaveAsrCredentials = jest.fn();

jest.mock('../../../hooks/useSettings', () => ({
  useApiKey: () => mockUseApiKey(),
  useSaveApiKey: () => mockUseSaveApiKey(),
  useAsrCredentials: () => mockUseAsrCredentials(),
  useSaveAsrCredentials: () => mockUseSaveAsrCredentials(),
}));

describe('maskApiKey helper', () => {
  it('6 位以内全部遮蔽', () => {
    expect(maskApiKey('abc')).toBe('***');
  });

  it('超过 6 位显示前 6 位 + ***', () => {
    expect(maskApiKey('sk-abc123456789')).toBe('sk-abc***');
  });

  it('恰好 6 位时全部遮蔽', () => {
    expect(maskApiKey('abcdef')).toBe('***');
  });
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApiKey.mockReturnValue({ data: null, isLoading: false });
    mockUseSaveApiKey.mockReturnValue(mockSaveApiKey);
    mockUseAsrCredentials.mockReturnValue({ data: null, isLoading: false });
    mockUseSaveAsrCredentials.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it('模块可以被导入', () => {
    expect(SettingsScreen).toBeDefined();
    expect(maskApiKey).toBeDefined();
  });

  it('maskApiKey 在模块中正确导出', () => {
    expect(maskApiKey('sk-test-12345678')).toBe('sk-tes***');
  });

  it('已保存 key 时 maskApiKey 展示脱敏结果', () => {
    const key = 'sk-abc123456789';
    const masked = maskApiKey(key);
    expect(masked).toBe('sk-abc***');
    expect(masked).not.toContain('123456789');
  });

  it('输入非空 key 后点击保存调用 mutate(key)', () => {
    const { getByPlaceholderText, getAllByText } = render(<SettingsScreen />);
    fireEvent.changeText(getByPlaceholderText('输入混元 API Key'), 'new-api-key-value');
    // Two '保存' buttons exist (API key + ASR); press the first one
    fireEvent.press(getAllByText('保存')[0]);
    expect(mockMutate).toHaveBeenCalledWith('new-api-key-value', expect.any(Object));
  });

  it('点击清除按钮弹出确认框（调用 Alert.alert）', () => {
    const { Alert } = require('react-native');
    mockUseApiKey.mockReturnValue({ data: 'sk-abc123456789', isLoading: false });
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('清除'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '确认清除',
      '确定要清除已保存的 API Key 吗？',
      expect.any(Array),
    );
  });
});
