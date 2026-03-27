import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Image,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCreateFragment } from '../hooks/useFragments';

export function FragmentInput() {
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const createFragment = useCreateFragment();

  const canSend = text.trim().length > 0 || photoUri !== null;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '需要相册权限',
        '请在系统设置中允许「意义编织」访问你的相册。',
        [{ text: '好的' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSend = () => {
    if (!canSend) return;

    createFragment.mutate(
      { content: text.trim(), photoUri: photoUri ?? undefined },
      {
        onSuccess: () => {
          setText('');
          setPhotoUri(null);
          // Keep keyboard open for continuous input
        },
      }
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Photo preview */}
      {photoUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
          <TouchableOpacity
            style={styles.removePhoto}
            onPress={() => setPhotoUri(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removePhotoText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.container}>
        {/* Photo picker button — native only */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handlePickPhoto}
            disabled={createFragment.isPending}
          >
            <Text style={styles.photoButtonText}>🖼</Text>
          </TouchableOpacity>
        )}

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="记录此刻的想法..."
          placeholderTextColor="#A0A0A0"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {canSend && (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={createFragment.isPending}
          >
            <Text style={styles.sendText}>
              {createFragment.isPending ? '...' : '记录'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  previewContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  photoButton: {
    marginRight: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F5F0EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#6B5B4F',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
