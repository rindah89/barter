import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { ArrowRight, Check } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  animation: any;
}

const onboardingData: OnboardingItem[] = [
  {
    id: '1',
    title: 'Find Items',
    description: 'Discover items from people in your community that you might want to trade for.',
    animation: require('../assets/welcome3.json'),
  },
  {
    id: '2',
    title: 'Make Trades',
    description: 'Propose trades for items you want, or accept trade offers from others.',
    animation: require('../assets/welcome2.json'),
  },
  {
    id: '3',
    title: 'Connect & Chat',
    description: 'Message other users to coordinate trades and build your community network.',
    animation: require('../assets/welcome1.json'),
  },
];

const OnboardingItem = ({ item }: { item: OnboardingItem }) => {
  const lottieRef = useRef<LottieView>(null);

  return (
    <View style={styles.itemContainer}>
      <View style={styles.animationContainer}>
        <LottieView
          ref={lottieRef}
          source={item.animation}
          style={styles.animation}
          autoPlay
          loop
        />
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.itemDescription}>{item.description}</Text>
    </View>
  );
};

const Pagination = ({ data, scrollX }: { data: OnboardingItem[], scrollX: Animated.Value }) => {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.paginationContainer}>
      {data.map((_, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [10, 20, 10],
          extrapolate: 'clamp',
        });
        
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });
        
        return (
          <Animated.View
            key={i.toString()}
            style={[
              styles.dot,
              { width: dotWidth, opacity },
            ]}
          />
        );
      })}
    </View>
  );
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  
  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0]?.index || 0);
  }).current;
  
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  
  const scrollTo = () => {
    if (currentIndex < onboardingData.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(tabs)');
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={onboardingData}
        renderItem={({ item }) => <OnboardingItem item={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
        scrollEventThrottle={32}
      />
      
      <Pagination data={onboardingData} scrollX={scrollX} />
      
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={scrollTo}
        >
          {currentIndex === onboardingData.length - 1 ? (
            <>
              <Text style={styles.buttonText}>Get Started</Text>
              <Check color="#fff" size={20} />
            </>
          ) : (
            <>
              <Text style={styles.buttonText}>Next</Text>
              <ArrowRight color="#fff" size={20} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  itemContainer: {
    flex: 1,
    width,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  animationContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 24,
  },
  paginationContainer: {
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginHorizontal: 5,
  },
  bottomContainer: {
    marginBottom: 50,
    paddingHorizontal: 20,
    width: '100%',
  },
  button: {
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
}); 