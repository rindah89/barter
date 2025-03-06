import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import LoadingIndicator from './LoadingIndicator';
import { useLoading } from '../lib/LoadingContext';

/**
 * A loading overlay that covers the entire screen when navigating between screens
 */
export default function LoadingOverlay() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isLoading}
    >
      <View style={styles.container}>
        <LoadingIndicator 
          message="Loading..." 
          size="large"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
}); 