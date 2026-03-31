import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Alert, Linking, Text, View } from 'react-native';
import { useDatabase } from '../src/hooks/useDatabase';
import { checkForUpdate } from '../src/services/update/updateService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function DatabaseGate({ children }: { children: React.ReactNode }) {
  const { repo, loading, error } = useDatabase();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 16, color: 'red', textAlign: 'center' }}>
          数据库初始化失败{'\n\n'}{error.message}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    checkForUpdate().then((result) => {
      if (!result.ok) return;
      const { version, downloadUrl } = result.value;
      Alert.alert(
        '发现新版本',
        `新版本 v${version} 已发布，是否立即更新？`,
        [
          { text: '稍后', style: 'cancel' },
          {
            text: '立即更新',
            onPress: () => Linking.openURL(downloadUrl),
          },
        ]
      );
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <DatabaseGate>
        <Slot />
      </DatabaseGate>
    </QueryClientProvider>
  );
}
