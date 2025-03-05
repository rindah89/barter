import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function TermsOfServiceScreen() {
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
            <Text style={styles.headerTitle}>Terms of Service</Text>
          </View>
          <View style={styles.iconContainer}>
            <FileText color="#FFFFFF" size={24} />
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
          <Text style={styles.sectionTitle}>Terms of Service for Barter</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          
          <Text style={styles.paragraph}>
            Welcome to Barter. Please read these Terms of Service ("Terms") carefully as they contain important information about your legal rights, remedies, and obligations. By accessing or using the Barter platform, you agree to comply with and be bound by these Terms.
          </Text>

          <Text style={styles.heading}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By creating an account or using any part of the Barter platform, you agree to these Terms. If you do not agree to these Terms, you may not access or use the Barter platform.
          </Text>

          <Text style={styles.heading}>2. Eligibility</Text>
          <Text style={styles.paragraph}>
            You must be at least 13 years old to use Barter. By using Barter, you represent and warrant that you meet this requirement and that you have the right, authority, and capacity to enter into these Terms.
          </Text>

          <Text style={styles.heading}>3. Account Registration</Text>
          <Text style={styles.paragraph}>
            To use certain features of Barter, you must register for an account. You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for safeguarding your account credentials and for all activities that occur under your account.
          </Text>

          <Text style={styles.heading}>4. User Conduct</Text>
          <Text style={styles.paragraph}>
            You agree not to:
          </Text>
          <Text style={styles.paragraph}>
            • Post illegal, harmful, threatening, abusive, or defamatory content
          </Text>
          <Text style={styles.paragraph}>
            • Impersonate any person or entity or falsely state your affiliation
          </Text>
          <Text style={styles.paragraph}>
            • Post items that violate intellectual property rights or other laws
          </Text>
          <Text style={styles.paragraph}>
            • Use Barter for any illegal purpose or to promote illegal activities
          </Text>
          <Text style={styles.paragraph}>
            • Interfere with or disrupt the operation of Barter or servers
          </Text>
          <Text style={styles.paragraph}>
            • Attempt to gain unauthorized access to Barter or user accounts
          </Text>

          <Text style={styles.heading}>5. Bartering and Transactions</Text>
          <Text style={styles.paragraph}>
            Barter is a platform that allows users to barter goods and services. We do not guarantee the quality, safety, or legality of items posted. All transactions are between users, and Barter is not a party to any transaction.
          </Text>
          <Text style={styles.paragraph}>
            Users are responsible for:
          </Text>
          <Text style={styles.paragraph}>
            • Accurately describing items offered for barter
          </Text>
          <Text style={styles.paragraph}>
            • Ensuring items comply with all applicable laws
          </Text>
          <Text style={styles.paragraph}>
            • Fulfilling agreed-upon barter exchanges
          </Text>
          <Text style={styles.paragraph}>
            • Resolving any disputes directly with other users
          </Text>

          <Text style={styles.heading}>6. Content and Intellectual Property</Text>
          <Text style={styles.paragraph}>
            You retain ownership of content you post on Barter. By posting content, you grant Barter a non-exclusive, worldwide, royalty-free license to use, copy, modify, and display the content in connection with operating and promoting the platform.
          </Text>
          <Text style={styles.paragraph}>
            You represent that you own or have the necessary rights to the content you post and that your content does not violate the rights of any third party.
          </Text>

          <Text style={styles.heading}>7. Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your access to Barter at any time for any reason without notice. You may terminate your account at any time by following the instructions in the app.
          </Text>

          <Text style={styles.heading}>8. Disclaimers</Text>
          <Text style={styles.paragraph}>
            BARTER IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </Text>
          <Text style={styles.paragraph}>
            WE DO NOT WARRANT THAT BARTER WILL BE UNINTERRUPTED OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT BARTER IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </Text>

          <Text style={styles.heading}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BARTER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
          </Text>

          <Text style={styles.heading}>10. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of the jurisdiction in which Barter is headquartered, without regard to its conflict of law provisions.
          </Text>

          <Text style={styles.heading}>11. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may modify these Terms at any time. We will notify you of material changes by posting the updated Terms on the platform and updating the "Last Updated" date. Your continued use of Barter after changes become effective constitutes acceptance of the updated Terms.
          </Text>

          <Text style={styles.heading}>12. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have questions about these Terms, please contact us at: 00237- 691-23-26-78
            
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