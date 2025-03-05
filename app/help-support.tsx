import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, HelpCircle, MessageCircle, Mail, Phone, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'How do I create a new listing?',
      answer: 'To create a new listing, go to the "Add Item" tab at the bottom of your screen. Take clear photos of your item, add a title, description, and select a category. Then tap "Post" to make your item available for trading.'
    },
    {
      id: 2,
      question: 'How does the trading process work?',
      answer: 'When you find an item you like, swipe right to express interest. If the owner also likes one of your items, it\'s a match! You can then chat with them to arrange the details of your trade. Once you both agree, you can meet in person to exchange items.'
    },
    {
      id: 3,
      question: 'Is there a rating system for users?',
      answer: 'Yes, after completing a trade, you can rate your trading partner. This helps build trust in the community. You can view a user\'s ratings on their profile page before deciding to trade with them.'
    },
    {
      id: 4,
      question: 'How do I report inappropriate content or users?',
      answer: 'If you come across inappropriate content or users, tap the three dots (...) on the item or user profile and select "Report". Choose the reason for reporting and submit. Our moderation team will review your report promptly.'
    },
    {
      id: 5,
      question: 'Can I delete my account?',
      answer: 'Yes, you can delete your account by going to Settings > Privacy Settings > Your Data > Delete My Account. Please note that this action is permanent and all your data will be removed from our servers.'
    },
    {
      id: 6,
      question: 'How do I change my password?',
      answer: 'To change your password, go to Settings > Account Security > Change Password. You\'ll need to enter your current password and then create a new one.'
    },
  ];

  const toggleFaq = (id) => {
    if (expandedFaq === id) {
      setExpandedFaq(null);
    } else {
      setExpandedFaq(id);
    }
  };

  const filteredFaqs = searchQuery 
    ? faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

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
            <Text style={styles.headerTitle}>Help & Support</Text>
          </View>
          <View style={styles.iconContainer}>
            <HelpCircle color="#FFFFFF" size={24} />
          </View>
        </View>
      </LinearGradient>

      {/* Main content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search color="#999999" size={20} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for help topics..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999999"
            />
          </View>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionDescription}>
            Need help? Reach out to our support team through one of these channels:
          </Text>
          
          <View style={styles.contactOptions}>
            <TouchableOpacity style={styles.contactOption}>
              <View style={styles.contactIconContainer}>
                <MessageCircle color="#22C55E" size={24} />
              </View>
              <Text style={styles.contactOptionText}>Live Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contactOption}>
              <View style={styles.contactIconContainer}>
                <Mail color="#22C55E" size={24} />
              </View>
              <Text style={styles.contactOptionText}>Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contactOption}>
              <View style={styles.contactIconContainer}>
                <Phone color="#22C55E" size={24} />
              </View>
              <Text style={styles.contactOptionText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map(faq => (
              <TouchableOpacity 
                key={faq.id} 
                style={styles.faqItem}
                onPress={() => toggleFaq(faq.id)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  {expandedFaq === faq.id ? (
                    <ChevronUp color="#22C55E" size={20} />
                  ) : (
                    <ChevronDown color="#22C55E" size={20} />
                  )}
                </View>
                
                {expandedFaq === faq.id && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noResultsText}>
              No results found for "{searchQuery}". Try a different search term.
            </Text>
          )}
        </View>

        <View style={styles.resourcesSection}>
          <Text style={styles.sectionTitle}>Additional Resources</Text>
          
          <TouchableOpacity style={styles.resourceItem}>
            <Text style={styles.resourceTitle}>User Guide</Text>
            <Text style={styles.resourceDescription}>
              Learn how to use all features of the Barter app
            </Text>
            <ExternalLink color="#22C55E" size={20} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.resourceItem}>
            <Text style={styles.resourceTitle}>Trading Safety Tips</Text>
            <Text style={styles.resourceDescription}>
              Important safety guidelines for in-person trades
            </Text>
            <ExternalLink color="#22C55E" size={20} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.resourceItem}>
            <Text style={styles.resourceTitle}>Community Guidelines</Text>
            <Text style={styles.resourceDescription}>
              Rules and standards for our trading community
            </Text>
            <ExternalLink color="#22C55E" size={20} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.feedbackButton}>
          <Text style={styles.feedbackButtonText}>Send App Feedback</Text>
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  contactSection: {
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
  contactOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactOption: {
    alignItems: 'center',
    width: '30%',
  },
  contactIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  faqSection: {
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
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 15,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
    paddingRight: 10,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666666',
    marginTop: 10,
    lineHeight: 20,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  resourcesSection: {
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
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    width: '40%',
  },
  resourceDescription: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    paddingRight: 10,
  },
  feedbackButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    margin: 20,
    marginTop: 10,
  },
  feedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 