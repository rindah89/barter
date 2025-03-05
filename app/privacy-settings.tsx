import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Eye, EyeOff, Globe, Users, UserX, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State for privacy toggles
  const [privacySettings, setPrivacySettings] = useState({
    locationSharing: true,
    profileVisibility: 'public', // 'public', 'contacts', 'private'
    activityStatus: true,
    dataCollection: true,
    personalization: true,
    thirdPartySharing: false
  });

  const toggleSwitch = (key) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const setProfileVisibility = (value) => {
    setPrivacySettings(prev => ({
      ...prev,
      profileVisibility: value
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
            <Text style={styles.headerTitle}>Privacy Settings</Text>
          </View>
          <View style={styles.iconContainer}>
            <Lock color="#FFFFFF" size={24} />
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
          <Text style={styles.sectionTitle}>Profile Visibility</Text>
          <Text style={styles.sectionDescription}>
            Control who can see your profile information and items.
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.visibilityOption, 
              privacySettings.profileVisibility === 'public' && styles.selectedOption
            ]}
            onPress={() => setProfileVisibility('public')}
          >
            <View style={styles.iconContainer2}>
              <Globe color="#22C55E" size={20} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Public</Text>
              <Text style={styles.optionDescription}>Anyone can view your profile and items</Text>
            </View>
            {privacySettings.profileVisibility === 'public' && (
              <View style={styles.selectedIndicator} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.visibilityOption, 
              privacySettings.profileVisibility === 'contacts' && styles.selectedOption
            ]}
            onPress={() => setProfileVisibility('contacts')}
          >
            <View style={styles.iconContainer2}>
              <Users color="#22C55E" size={20} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Contacts Only</Text>
              <Text style={styles.optionDescription}>Only people you've traded with can view your profile</Text>
            </View>
            {privacySettings.profileVisibility === 'contacts' && (
              <View style={styles.selectedIndicator} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.visibilityOption, 
              privacySettings.profileVisibility === 'private' && styles.selectedOption
            ]}
            onPress={() => setProfileVisibility('private')}
          >
            <View style={styles.iconContainer2}>
              <UserX color="#22C55E" size={20} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Private</Text>
              <Text style={styles.optionDescription}>Hide your profile details from other users</Text>
            </View>
            {privacySettings.profileVisibility === 'private' && (
              <View style={styles.selectedIndicator} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Activity</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Share Location</Text>
              <Text style={styles.settingDescription}>Allow the app to use your location for nearby trades</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('locationSharing')}
              value={privacySettings.locationSharing}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Show Activity Status</Text>
              <Text style={styles.settingDescription}>Let others see when you're online</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('activityStatus')}
              value={privacySettings.activityStatus}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Personalization</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Data Collection</Text>
              <Text style={styles.settingDescription}>Allow us to collect usage data to improve the app</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('dataCollection')}
              value={privacySettings.dataCollection}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Personalized Experience</Text>
              <Text style={styles.settingDescription}>Receive personalized recommendations based on your activity</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('personalization')}
              value={privacySettings.personalization}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Third-Party Data Sharing</Text>
              <Text style={styles.settingDescription}>Allow sharing data with third-party services</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('thirdPartySharing')}
              value={privacySettings.thirdPartySharing}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          
          <TouchableOpacity style={styles.dataButton}>
            <View style={styles.dataButtonIcon}>
              <Eye color="#22C55E" size={20} />
            </View>
            <Text style={styles.dataButtonText}>View My Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dataButton}>
            <View style={styles.dataButtonIcon}>
              <Trash2 color="#FF3B30" size={20} />
            </View>
            <Text style={[styles.dataButtonText, { color: '#FF3B30' }]}>Delete My Account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
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
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  selectedOption: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  iconContainer2: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  selectedIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginLeft: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
  },
  dataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  dataButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  dataButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#22C55E',
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