/**
 * TDD: useSettings hook
 *
 * 策略：unit test hook 的调用契约
 * - useApiKey: queryFn 调用 repo.getApiKey()
 * - useSaveApiKey: mutationFn 调用 repo.setApiKey(key)
 *
 * 由于测试环境没有 React DOM，直接测试 hook 内部逻辑的调用链。
 */

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock @tanstack/react-query
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQueryClient = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

// Mock useDatabase
const mockRepo = {
  getApiKey: jest.fn(),
  setApiKey: jest.fn(),
};
jest.mock('../useDatabase', () => ({
  useDatabase: () => ({ repo: mockRepo }),
}));

describe('useApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: null, isSuccess: false });
  });

  it('调用 useQuery 时 queryKey 包含 settings 和 apiKey', () => {
    const { useApiKey } = require('../useSettings');
    useApiKey();

    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    const callArg = mockUseQuery.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['settings', 'apiKey']);
  });

  it('queryFn 调用 repo.getApiKey()', async () => {
    mockRepo.getApiKey.mockResolvedValue('stored-key');
    const { useApiKey } = require('../useSettings');
    useApiKey();

    const callArg = mockUseQuery.mock.calls[0][0];
    await callArg.queryFn();

    expect(mockRepo.getApiKey).toHaveBeenCalledTimes(1);
  });

  it('enabled 为 true（repo 存在）', () => {
    const { useApiKey } = require('../useSettings');
    useApiKey();

    const callArg = mockUseQuery.mock.calls[0][0];
    expect(callArg.enabled).toBe(true);
  });
});

describe('useSaveApiKey', () => {
  const mockInvalidateQueries = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutate: jest.fn() });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  });

  it('调用 useMutation 时 mutationFn 调用 repo.setApiKey(key)', async () => {
    mockRepo.setApiKey.mockResolvedValue(undefined);
    const { useSaveApiKey } = require('../useSettings');
    useSaveApiKey();

    const callArg = mockUseMutation.mock.calls[0][0];
    await callArg.mutationFn('new-key');

    expect(mockRepo.setApiKey).toHaveBeenCalledWith('new-key');
  });

  it('onSuccess 时 invalidateQueries settings/apiKey', async () => {
    const { useSaveApiKey } = require('../useSettings');
    useSaveApiKey();

    const callArg = mockUseMutation.mock.calls[0][0];
    await callArg.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['settings', 'apiKey'],
    });
  });
});
