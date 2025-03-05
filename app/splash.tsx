import React from 'react';
import { View, StyleSheet } from 'react-native';
import SplashScreen from './components/SplashScreen';

export default function SplashPage() {
  return (
    <View style={styles.container}>
      <SplashScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
}); 