import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { Fragment } from '../db/schema';
import { useRecentFragments, useDeleteFragment } from '../hooks/useFragments';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (isToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `昨天 ${time}`;

  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

function FragmentItem({ fragment }: { fragment: Fragment }) {
  const deleteFragment = useDeleteFragment();

  const handleLongPress = () => {
    Alert.alert(
      '删除碎片',
      '确定要删除这条记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteFragment.mutate(fragment.id),
        },
      ]
    );
  };

  const hasText = fragment.content.trim().length > 0;
  const hasPhoto = !!fragment.photo_uri;

  return (
    <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.7}>
      <View style={styles.item}>
        {hasPhoto && (
          <Image
            source={{ uri: fragment.photo_uri! }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}
        {hasText && (
          <Text style={styles.content}>{fragment.content}</Text>
        )}
        {!hasText && !hasPhoto && (
          <Text style={[styles.content, styles.placeholder]}>（照片）</Text>
        )}
        <Text style={styles.time}>{formatTime(fragment.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function FragmentList() {
  const { data: fragments, isLoading } = useRecentFragments();

  const renderItem = useCallback(
    ({ item }: { item: Fragment }) => <FragmentItem fragment={item} />,
    []
  );

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>加载中...</Text>
      </View>
    );
  }

  if (!fragments || fragments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🌱</Text>
        <Text style={styles.emptyTitle}>开始记录你的碎片</Text>
        <Text style={styles.emptyText}>
          随手写下此刻的想法、感受、发生的事。{'\n'}
          不需要完整，不需要漂亮。{'\n'}
          AI 会帮你在这些碎片中发现意义。
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={fragments}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});
