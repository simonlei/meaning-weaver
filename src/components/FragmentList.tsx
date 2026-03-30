import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { Fragment } from '../db/schema';
import { useRecentFragments, useDeleteFragment } from '../hooks/useFragments';
import { AudioPlayerProvider, useAudioPlayerContext } from '../contexts/AudioPlayerContext';

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

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Audio playback component — only rendered on native when audio_uri is present */
function AudioPlayButton({ fragmentId, audioUri }: { fragmentId: string; audioUri: string }) {
  const [audioExists, setAudioExists] = useState<boolean | null>(null); // null = checking
  const { playingId, setPlayingId, registerStopCallback, unregisterStopCallback } = useAudioPlayerContext();
  const isPlaying = playingId === fragmentId;

  const player = useAudioPlayer(isPlaying ? audioUri : null);
  const status = useAudioPlayerStatus(player);

  // Register a stop callback so AudioPlayerContext can stop us
  useEffect(() => {
    registerStopCallback(fragmentId, () => {
      player.pause();
    });
    return () => {
      unregisterStopCallback(fragmentId);
      player.remove();
    };
  }, [fragmentId, player, registerStopCallback, unregisterStopCallback]);

  useEffect(() => {
    try {
      setAudioExists(new File(audioUri).exists);
    } catch {
      setAudioExists(false);
    }
  }, [audioUri]);

  // When playback ends naturally, reset context
  useEffect(() => {
    if (status && !status.playing && isPlaying && (status.currentTime ?? 0) > 0) {
      const dur = status.duration ?? 0;
      const cur = status.currentTime ?? 0;
      // Detect end of track (within 0.5s of duration)
      if (dur > 0 && Math.abs(cur - dur) < 0.5) {
        setPlayingId(null);
      }
    }
  }, [status, isPlaying, setPlayingId]);

  if (audioExists === false) {
    // File missing — don't render button
    return null;
  }

  if (audioExists === null) {
    // Still checking
    return null;
  }

  const handlePress = () => {
    if (isPlaying) {
      player.pause();
      setPlayingId(null);
    } else {
      setPlayingId(fragmentId);
      player.play();
    }
  };

  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={audioStyles.container}>
      <TouchableOpacity onPress={handlePress} style={audioStyles.button}>
        <Text style={audioStyles.buttonText}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      {isPlaying && duration > 0 && (
        <View style={audioStyles.progressRow}>
          <View style={audioStyles.progressTrack}>
            <View style={[audioStyles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
          </View>
          <Text style={audioStyles.progressTime}>
            {formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}
          </Text>
        </View>
      )}
    </View>
  );
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
  const hasAudio = !!fragment.audio_uri;

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
        {hasPhoto && fragment.photo_description && (
          <Text style={styles.photoDescription}>{fragment.photo_description}</Text>
        )}
        {hasText && (
          <Text style={styles.content}>{fragment.content}</Text>
        )}
        {!hasText && !hasPhoto && !hasAudio && (
          <Text style={[styles.content, styles.placeholder]}>（照片）</Text>
        )}
        {!hasText && !hasPhoto && hasAudio && (
          <Text style={[styles.content, styles.placeholder]}>（语音记录）</Text>
        )}
        {/* Audio playback — native only */}
        {hasAudio && Platform.OS !== 'web' && (
          <AudioPlayButton fragmentId={fragment.id} audioUri={fragment.audio_uri!} />
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
    <AudioPlayerProvider>
      <FlatList
        data={fragments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </AudioPlayerProvider>
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
  photoDescription: {
    fontSize: 13,
    color: '#777',
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 6,
    paddingHorizontal: 2,
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

const audioStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EBE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B5B4F',
    borderRadius: 2,
  },
  progressTime: {
    fontSize: 11,
    color: '#999',
    minWidth: 70,
    textAlign: 'right',
  },
});
