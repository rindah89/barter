import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, MessageSquare, RefreshCw, Heart, Star, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State for notification toggles
  const [notifications, setNotifications] = useState({
    tradeRequests: true,
    messages: true,
    tradeUpdates: true,
    favorites: true,
    reviews: true,
    announcements: false
  });

  const toggleSwitch = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Header with gradient */}
      <LinearGradient
        colors={['#22C55E', '#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Notification Preferences</Text>
          </View>
          <View style={styles.iconContainer}>
            <Bell color="#FFFFFF" size={24} />
          </View>
        </View>
      </LinearGradient>

      {/* Main content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <Text style={styles.sectionDescription}>
            Control which notifications you receive from Barter. You can turn off specific types of notifications or disable all notifications.
          </Text>
          
          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <RefreshCw color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Trade Requests</Text>
              <Text style={styles.notificationDescription}>Receive notifications when someone wants to trade with you</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('tradeRequests')}
              value={notifications.tradeRequests}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <MessageSquare color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Messages</Text>
              <Text style={styles.notificationDescription}>Receive notifications for new messages</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('messages')}
              value={notifications.messages}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <RefreshCw color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Trade Updates</Text>
              <Text style={styles.notificationDescription}>Receive notifications about trade status changes</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('tradeUpdates')}
              value={notifications.tradeUpdates}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <Heart color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Favorites</Text>
              <Text style={styles.notificationDescription}>Receive notifications when someone favorites your items</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('favorites')}
              value={notifications.favorites}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <Star color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Reviews</Text>
              <Text style={styles.notificationDescription}>Receive notifications when someone reviews you</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('reviews')}
              value={notifications.reviews}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationIconContainer}>
              <Info color="#22C55E" size={20} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>Announcements</Text>
              <Text style={styles.notificationDescription}>Receive notifications about app updates and news</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('announcements')}
              value={notifications.announcements}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Notifications</Text>
          <Text style={styles.sectionDescription}>
            Email notifications are sent to your registered email address. You can manage these settings separately from push notifications.
          </Text>
          
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Manage Email Preferences</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 20,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    height: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 80, // To account for the gradient header
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    marginBottom: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  notificationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666666',
  },
  button: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    margin: 20,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 