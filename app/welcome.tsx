import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, Sparkles, RefreshCw, Users, Leaf } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// Define types for AnimatedCard props
interface AnimatedCardProps {
  cardStyle: object;
  icon: React.ReactNode;
  text: string;
}

// Animated card component with touch effects
const AnimatedCard = ({ cardStyle, icon, text }: AnimatedCardProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Map rotation value to degrees - determine rotation based on card type
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', cardStyle === styles.card1 ? '-10deg' : cardStyle === styles.card3 ? '10deg' : '0deg'],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          cardStyle,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: rotate },
            ],
            shadowOpacity: 0.2,
          },
        ]}
      >
        {icon}
        <Text style={styles.cardText}>{text}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [showGetStarted, setShowGetStarted] = useState(false);

  // Animated values for button
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sequence animations
    Animated.sequence([
      // First fade in the logo and title
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Then slide up the illustration
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Finally fade in the buttons
      Animated.timing(buttonFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#22C55E', '#10B981']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logoipsum-225.png')} style={{ width: 32, height: 32 }} />
          </View>
          <Text style={styles.title}>Barter</Text>
          <Text style={styles.subtitle}>Trade goods and services with your community</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.illustrationContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
            },
          ]}
        >
          <View style={styles.illustrationContent}>
            <View style={styles.illustrationGraphic}>
              <AnimatedCard 
                cardStyle={styles.card1} 
                icon={<RefreshCw color="#22C55E" size={24} />}
                text="Swap"
              />
              <AnimatedCard 
                cardStyle={styles.card2} 
                icon={<Users color="#22C55E" size={24} />}
                text="Connect"
              />
              <AnimatedCard 
                cardStyle={styles.card3} 
                icon={<Leaf color="#22C55E" size={24} />}
                text="Sustain"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.buttonContainer, { opacity: buttonFadeAnim }]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <ArrowRight color="#22C55E" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom section with buttons */}
      <View style={styles.bottomSection}>
        {showGetStarted ? (
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => {
              Animated.sequence([
                Animated.timing(buttonScale, {
                  toValue: 0.95,
                  duration: 100,
                  useNativeDriver: true
                }),
                Animated.timing(buttonScale, {
                  toValue: 1,
                  duration: 100,
                  useNativeDriver: true
                })
              ]).start();
              setTimeout(() => router.push('/onboarding'), 200);
            }}
          >
            <Animated.View style={[{ transform: [{ scale: buttonScale }] }]}>
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.scrollButton}
            onPress={() => {
              scrollToContent();
            }}
          >
            <ArrowRight color="#FFFFFF" size={24} />
          </TouchableOpacity>
        )}
        
        {/* Debug Button */}
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => router.push('/auth/debug')}
        >
          <Text style={styles.debugButtonText}>Debug</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 24,
  },
  illustrationContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    height: height * 0.25,
  },
  illustrationContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationGraphic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    height: 150,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    width: 100,
    height: 100,
    position: 'absolute',
  },
  card1: {
    left: width * 0.1,
    zIndex: 3,
    transform: [{ rotate: '-5deg' }],
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  card2: {
    zIndex: 2,
    backgroundColor: '#ECFDF5',
    borderColor: '#22C55E',
  },
  card3: {
    right: width * 0.1,
    zIndex: 1,
    transform: [{ rotate: '5deg' }],
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  cardText: {
    color: '#666',
    marginTop: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 30,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 18,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22C55E',
    marginRight: 8,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  getStartedButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  scrollButton: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
  },
  debugButton: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 