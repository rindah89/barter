import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingIndicatorProps {
  message?: string;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
}

/**
 * A reusable loading indicator component that uses Lottie animation
 */
export default function LoadingIndicator({
  message,
  containerStyle,
  textStyle,
  size = 'medium',
}: LoadingIndicatorProps) {
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, []);

  // Determine animation size based on the size prop
  const getAnimationSize = () => {
    switch (size) {
      case 'small':
        return { width: 80, height: 80 };
      case 'large':
        return { width: 200, height: 200 };
      case 'medium':
      default:
        return { width: 120, height: 120 };
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <LottieView
        ref={lottieRef}
        source={require('../assets/loading.json')}
        style={[styles.animation, getAnimationSize()]}
        autoPlay
        loop
      />
      {message && <Text style={[styles.text, textStyle]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  animation: {
    alignSelf: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
}); 