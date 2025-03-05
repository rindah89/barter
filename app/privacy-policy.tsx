import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            <Text style={styles.headerTitle}>Privacy Policy</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy for Barter</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          
          <Text style={styles.paragraph}>
            Welcome to Barter. We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>

          <Text style={styles.heading}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Personal Information:</Text> When you create an account, we collect your name, email address, and optional profile information such as location, bio, and profile picture.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>User Content:</Text> Information about items you post for bartering, including descriptions, images, and condition.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Communication Data:</Text> Messages exchanged with other users through our platform.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Usage Information:</Text> How you interact with our app, including browsing behavior, search queries, and feature usage.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Device Information:</Text> Information about your mobile device, including device model, operating system, and unique device identifiers.
          </Text>

          <Text style={styles.heading}>2. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            • To create and maintain your account
          </Text>
          <Text style={styles.paragraph}>
            • To facilitate bartering transactions between users
          </Text>
          <Text style={styles.paragraph}>
            • To improve our services and develop new features
          </Text>
          <Text style={styles.paragraph}>
            • To communicate with you about your account or transactions
          </Text>
          <Text style={styles.paragraph}>
            • To ensure the safety and security of our platform
          </Text>
          <Text style={styles.paragraph}>
            • To personalize your experience and show relevant items
          </Text>

          <Text style={styles.heading}>3. Information Sharing and Disclosure</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>With Other Users:</Text> Your profile information, items, and communications are shared with other users as necessary for bartering transactions.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Service Providers:</Text> We may share information with third-party vendors who help us operate our services.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Legal Requirements:</Text> We may disclose information if required by law or to protect rights, safety, and property.
          </Text>

          <Text style={styles.heading}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate technical and organizational measures to protect your personal information from unauthorized access, loss, or alteration. However, no internet transmission is completely secure, and we cannot guarantee the security of information transmitted through our platform.
          </Text>

          <Text style={styles.heading}>5. Your Rights and Choices</Text>
          <Text style={styles.paragraph}>
            You can access, update, or delete your account information through the app settings. You may also request a copy of your data or ask us to restrict processing in certain circumstances.
          </Text>

          <Text style={styles.heading}>6. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our services are not intended for users under 13 years of age, and we do not knowingly collect personal information from children.
          </Text>

          <Text style={styles.heading}>7. Changes to This Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </Text>

          <Text style={styles.heading}>8. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions or concerns about this Privacy Policy, please contact us at: 00237- 691-23-26-78
          </Text>
          <Text style={styles.paragraph}>
            Email: info@edafricagroup.com
          </Text>
          <Text style={styles.paragraph}>
            Address: Kotto Douala, Cameroon
          </Text>
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
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 25,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
}); 