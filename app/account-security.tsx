import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Key, Smartphone, History, LogOut, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function AccountSecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State for security toggles
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    biometricLogin: true,
    loginAlerts: true,
    rememberDevice: true,
  });

  const toggleSwitch = (key: keyof typeof securitySettings) => {
    setSecuritySettings(prev => ({
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
            <Text style={styles.headerTitle}>Account Security</Text>
          </View>
          <View style={styles.iconContainer}>
            <Shield color="#FFFFFF" size={24} />
          </View>
        </View>
      </LinearGradient>

      {/* Main content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.securityStatusCard}>
          <View style={styles.securityStatusHeader}>
            <Shield color="#22C55E" size={24} />
            <Text style={styles.securityStatusTitle}>Security Status</Text>
          </View>
          <View style={styles.securityStatusMeter}>
            <View style={styles.securityStatusBar}>
              <View style={[styles.securityStatusFill, { width: '70%' }]} />
            </View>
            <Text style={styles.securityStatusText}>Good</Text>
          </View>
          <Text style={styles.securityStatusDescription}>
            Your account security is good, but could be improved by enabling two-factor authentication.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Password Management</Text>
          
          <TouchableOpacity style={styles.securityItem}>
            <View style={styles.securityIconContainer}>
              <Key color="#22C55E" size={20} />
            </View>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Change Password</Text>
              <Text style={styles.securityItemDescription}>Last changed 3 months ago</Text>
            </View>
            <ArrowLeft color="#999999" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={styles.passwordStrengthContainer}>
            <Text style={styles.passwordStrengthLabel}>Password Strength</Text>
            <View style={styles.passwordStrengthBar}>
              <View style={[styles.passwordStrengthFill, { width: '80%', backgroundColor: '#22C55E' }]} />
            </View>
            <Text style={styles.passwordStrengthText}>Strong</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
          <Text style={styles.sectionDescription}>
            Add an extra layer of security to your account by requiring a verification code in addition to your password.
          </Text>
          
          <View style={styles.twoFactorContainer}>
            <View style={styles.twoFactorHeader}>
              <View style={styles.securityIconContainer}>
                <Smartphone color="#22C55E" size={20} />
              </View>
              <View style={styles.securityTextContainer}>
                <Text style={styles.securityItemTitle}>Two-Factor Authentication</Text>
                <Text style={styles.securityItemDescription}>
                  {securitySettings.twoFactorAuth ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E5E5"
                onValueChange={() => toggleSwitch('twoFactorAuth')}
                value={securitySettings.twoFactorAuth}
              />
            </View>
            
            {!securitySettings.twoFactorAuth && (
              <TouchableOpacity style={styles.setupButton}>
                <Text style={styles.setupButtonText}>Set Up Two-Factor Authentication</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Login Settings</Text>
          
          <View style={styles.securityToggleItem}>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Biometric Login</Text>
              <Text style={styles.securityItemDescription}>Use Face ID or Touch ID to log in</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('biometricLogin')}
              value={securitySettings.biometricLogin}
            />
          </View>

          <View style={styles.securityToggleItem}>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Login Alerts</Text>
              <Text style={styles.securityItemDescription}>Get notified of new logins to your account</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('loginAlerts')}
              value={securitySettings.loginAlerts}
            />
          </View>

          <View style={styles.securityToggleItem}>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Remember Device</Text>
              <Text style={styles.securityItemDescription}>Stay logged in on this device</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E5E5", true: "#22C55E" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5E5"
              onValueChange={() => toggleSwitch('rememberDevice')}
              value={securitySettings.rememberDevice}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Login Activity</Text>
          
          <TouchableOpacity style={styles.securityItem}>
            <View style={styles.securityIconContainer}>
              <History color="#22C55E" size={20} />
            </View>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Login History</Text>
              <Text style={styles.securityItemDescription}>View your recent login activity</Text>
            </View>
            <ArrowLeft color="#999999" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.securityItem}>
            <View style={styles.securityIconContainer}>
              <LogOut color="#22C55E" size={20} />
            </View>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Log Out of All Devices</Text>
              <Text style={styles.securityItemDescription}>Sign out from all devices except this one</Text>
            </View>
            <ArrowLeft color="#999999" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Recovery</Text>
          
          <TouchableOpacity style={styles.securityItem}>
            <View style={styles.securityIconContainer}>
              <AlertTriangle color="#22C55E" size={20} />
            </View>
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityItemTitle}>Recovery Options</Text>
              <Text style={styles.securityItemDescription}>Set up methods to recover your account</Text>
            </View>
            <ArrowLeft color="#999999" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>
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
  securityStatusCard: {
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
  securityStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  securityStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 10,
  },
  securityStatusMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  securityStatusBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    marginRight: 10,
    overflow: 'hidden',
  },
  securityStatusFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  securityStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    width: 50,
  },
  securityStatusDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
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
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  securityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  securityItemDescription: {
    fontSize: 14,
    color: '#666666',
  },
  passwordStrengthContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  passwordStrengthLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 10,
  },
  passwordStrengthBar: {
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    marginBottom: 5,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 4,
  },
  passwordStrengthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'right',
  },
  twoFactorContainer: {
    marginTop: 10,
  },
  twoFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  setupButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  setupButtonText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
  },
  securityToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
}); 