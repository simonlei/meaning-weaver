import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useCreateFragment } from '../hooks/useFragments';

export function FragmentInput() {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const createFragment = useCreateFragment();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    createFragment.mutate(trimmed, {
      onSuccess: () => {
        setText('');
        // Keep keyboard open for continuous input
      },
    });
  };

  return (
    <View style={styles.container}>
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
      {text.trim().length > 0 && (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
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
