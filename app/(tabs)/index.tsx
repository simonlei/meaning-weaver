import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { FragmentInput } from '../../src/components/FragmentInput';
import { FragmentList } from '../../src/components/FragmentList';

export default function FragmentsScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.listArea}>
        <FragmentList />
      </View>
      <FragmentInput />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  listArea: {
    flex: 1,
  },
});
