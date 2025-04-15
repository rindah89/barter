import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator, Alert, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Edit2, Star, LogOut, Camera, X, Heart, LucidePackage, Info, Search, RotateCcw, User, FileText, Tag, MessageCircle, RefreshCw, MapPin, Calendar, Clock, MessageSquare, Bell, Lock, Shield, HelpCircle, ShieldCheck, Mail, Plus } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import * as ImagePicker from 'expo-image-picker';
import LogoutButton from '../../components/LogoutButton';
import { getDefaultAvatar } from '../../lib/useDefaultAvatar';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Database } from '../../database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ProfileScreen() {
  const { user } = useAuth();
  const { profile, loading, error, refreshProfile, updateProfile } = useProfile();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    name: '',
    email: '',
    bio: '',
    location: '',
    avatar_url: '',
    interest: [] as string[]
  });
  const [interestInput, setInterestInput] = useState('');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user && user.id) {
      fetchReviews();
    } else {
      console.log('[ProfileScreen] No user or user.id available, skipping review fetch');
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setEditedProfile({
        name: profile.name || '',
        email: user?.email || '',
        bio: profile.bio || '',
        location: profile.location || '',
        avatar_url: profile.avatar_url || '',
        interest: profile.interest || []
      });
    }
  }, [profile, user]);

  const fetchReviews = async () => {
    if (!user || !user.id) {
      console.log('[ProfileScreen] Cannot fetch reviews: No user or user.id');
      return;
    }
    
    try {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:reviewer_id(name, avatar_url),
          trade:trade_id(created_at)
        `)
        .eq('reviewed_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) {
        console.error('[ProfileScreen] Error fetching reviews:', error);
        throw error;
      }
      
      setReviews(data || []);
    } catch (err) {
      console.error('[ProfileScreen] Error in fetchReviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    
    try {
      setImageUploading(true);
      
      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setEditedProfile({...editedProfile, avatar_url: data.publicUrl});
    } catch (err) {
      console.error('Error uploading avatar:', err);
      Alert.alert('Error', 'Failed to upload avatar');
    } finally {
      setImageUploading(false);
    }
  };

  const handleAddInterest = () => {
    if (interestInput.trim() !== '' && !editedProfile.interest.includes(interestInput.trim())) {
      setEditedProfile({
        ...editedProfile,
        interest: [...editedProfile.interest, interestInput.trim()]
      });
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setEditedProfile({
      ...editedProfile,
      interest: editedProfile.interest.filter(i => i !== interest)
    });
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    try {
      // Update the profile with all fields including interest
      const { error } = await updateProfile({
        name: editedProfile.name,
        bio: editedProfile.bio,
        location: editedProfile.location,
        avatar_url: editedProfile.avatar_url,
        interest: editedProfile.interest,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      
      setEditModalVisible(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.errorButton} onPress={refreshProfile}>
          <Text style={styles.errorButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found. Please complete your profile setup.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Fixed position header with gradient */}
      <LinearGradient
        colors={['#22C55E', '#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{profile.name?.split(' ')[0] || 'Profile'}</Text>
            <Text style={styles.headerSubtitle}>Your barter profile</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Settings color="#FFFFFF" size={24} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main scrollable content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        overScrollMode="always"
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image 
                source={profile.avatar_url ? { uri: profile.avatar_url } : { uri: getDefaultAvatar() }} 
                style={styles.avatar} 
              />
              <TouchableOpacity style={styles.editAvatarButton} onPress={() => setEditModalVisible(true)}>
                <Camera color="#FFFFFF" size={18} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profile.name}</Text>
              <View style={styles.infoRow}>
                <MapPin color="#666666" size={14} />
                <Text style={styles.location}>{profile.location || 'No location set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Calendar color="#666666" size={14} />
                <Text style={styles.joinDate}>Member since {formatDate(profile.created_at)}</Text>
              </View>
              <TouchableOpacity 
                style={styles.editProfileButton} 
                onPress={() => setEditModalVisible(true)}
              >
                <Edit2 color="#FFFFFF" size={16} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Star fill="#FFD700" color="#FFD700" size={22} />
              </View>
              <Text style={styles.statValue}>{profile.rating?.toFixed(1) || 'N/A'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <RefreshCw color="#22C55E" size={22} />
              </View>
              <Text style={styles.statValue}>{profile.completed_trades || 0}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Tag color="#22C55E" size={22} />
              </View>
              <Text style={styles.statValue}>{profile.interest?.length || 0}</Text>
              <Text style={styles.statLabel}>Interests</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <FileText color="#22C55E" size={20} />
            <Text style={styles.sectionTitle}>About Me</Text>
          </View>
          <Text style={styles.bioText}>{profile.bio || 'No bio information provided.'}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <Tag color="#22C55E" size={20} />
            <Text style={styles.sectionTitle}>Interests</Text>
          </View>
          <View style={styles.interestsContainer}>
            {profile.interest && profile.interest.length > 0 ? (
              profile.interest.map((item: string, index: number) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noInterestsText}>No interests added yet</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <MessageCircle color="#22C55E" size={20} />
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
          </View>
          {reviewsLoading ? (
            <ActivityIndicator size="small" color="#22C55E" />
          ) : reviews.length > 0 ? (
            reviews.map((review: any, index: number) => (
              <ReviewItem 
                key={index}
                name={review.reviewer.name}
                avatar={review.reviewer.avatar_url}
                rating={review.rating}
                date={formatDate(review.created_at)}
                comment={review.comment}
              />
            ))
          ) : (
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          )}
        </View>
        
        {/* Add padding at the bottom for better scrolling experience */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <X color="#333333" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.avatarEditContainer}>
                <Image 
                  source={editedProfile.avatar_url ? { uri: editedProfile.avatar_url } : { uri: getDefaultAvatar() }} 
                  style={styles.avatarLarge} 
                />
                <TouchableOpacity 
                  style={styles.avatarEditButton} 
                  onPress={pickImage} 
                  disabled={imageUploading}
                >
                  {imageUploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Camera color="#FFFFFF" size={20} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <View style={styles.inputContainer}>
                  <User color="#22C55E" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedProfile.name}
                    onChangeText={(text) => setEditedProfile({...editedProfile, name: text})}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <Mail color="#999999" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: '#999' }]}
                    value={editedProfile.email}
                    editable={false}
                    keyboardType="email-address"
                  />
                </View>
                <Text style={styles.helperText}>Email cannot be changed</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.inputContainer}>
                  <MapPin color="#22C55E" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedProfile.location}
                    onChangeText={(text) => setEditedProfile({...editedProfile, location: text})}
                    placeholder="City, State/Province"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <View style={styles.inputContainer}>
                  <FileText color="#22C55E" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editedProfile.bio}
                    onChangeText={(text) => setEditedProfile({...editedProfile, bio: text})}
                    multiline={true}
                    numberOfLines={4}
                    placeholder="Tell others about yourself"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Interests</Text>
                <View style={styles.interestInputContainer}>
                  <View style={styles.interestIconContainer}>
                    <Tag color="#22C55E" size={20} />
                  </View>
                  <TextInput
                    style={styles.interestInput}
                    value={interestInput}
                    onChangeText={setInterestInput}
                    placeholder="Add an interest"
                  />
                  <TouchableOpacity 
                    style={styles.addInterestButton}
                    onPress={handleAddInterest}
                  >
                    <Plus color="#FFFFFF" size={20} />
                  </TouchableOpacity>
                </View>
                <View style={styles.editInterestsContainer}>
                  {editedProfile.interest.map((interest, index) => (
                    <View key={index} style={styles.editInterestTag}>
                      <Text style={styles.editInterestText}>{interest}</Text>
                      <TouchableOpacity 
                        style={styles.removeInterestButton}
                        onPress={() => handleRemoveInterest(interest)}
                      >
                        <X color="#FF3B30" size={14} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setSettingsModalVisible(false)}
              >
                <X color="#333333" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsContent}>
              {/* Notification Preferences */}
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/notification-preferences');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <Bell color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Notification Preferences</Text>
              </TouchableOpacity>

              {/* Privacy Settings */}
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/privacy-settings');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <Lock color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Privacy Settings</Text>
              </TouchableOpacity>

              {/* Account Security */}
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/account-security');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <Shield color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Account Security</Text>
              </TouchableOpacity>

              {/* Help & Support */}
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/help-support');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <HelpCircle color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Help & Support</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/terms-of-service');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <FileText color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Terms of Service</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.settingsItem, { marginBottom: 20 }]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/privacy-policy');
                }}
              >
                <View style={styles.settingsItemIconContainer}>
                  <ShieldCheck color="#22C55E" size={20} />
                </View>
                <Text style={styles.settingsItemText}>Privacy Policy</Text>
              </TouchableOpacity>
              
              <LogoutButton style={styles.logoutButton} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Review Item Component
function ReviewItem({ 
  name, 
  avatar, 
  rating, 
  date, 
  comment 
}: { 
  name: string; 
  avatar: string | null; 
  rating: number; 
  date: string; 
  comment: string | null;
}) {
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewUser}>
          <Image 
            source={avatar ? { uri: avatar } : { uri: getDefaultAvatar() }} 
            style={styles.reviewAvatar} 
          />
          <View>
            <Text style={styles.reviewName}>{name}</Text>
            <View style={styles.reviewDateContainer}>
              <Clock color="#999999" size={12} />
              <Text style={styles.reviewDate}>{date}</Text>
            </View>
          </View>
        </View>
        <View style={styles.reviewRating}>
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              size={16} 
              color="#FFD700" 
              fill={i < rating ? "#FFD700" : "transparent"} 
            />
          ))}
        </View>
      </View>
      <View style={styles.reviewCommentContainer}>
        <MessageSquare color="#22C55E" size={16} style={styles.reviewCommentIcon} />
        <Text style={styles.reviewComment}>{comment}</Text>
      </View>
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
  headerTitleContainer: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
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
    paddingBottom: 40, // Add padding at the bottom for better scrolling experience
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    marginTop: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 15,
    backgroundColor: '#22C55E',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  location: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 6,
  },
  joinDate: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 6,
    marginBottom: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingVertical: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 16,
    padding: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
    backgroundColor: '#E5E5E5',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 10,
  },
  bioText: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  interestText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 15,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  reviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  reviewDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 4,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCommentIcon: {
    marginRight: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    padding: 20,
  },
  avatarEditContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#F2F2F7',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#22C55E',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
  },
  inputIcon: {
    marginRight: 10,
    color: '#666',
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  interestInputContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  interestIconContainer: {
    marginRight: 10,
  },
  interestInput: {
    flex: 1,
    fontSize: 16,
  },
  addInterestButton: {
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
  },
  editInterestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  editInterestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  editInterestText: {
    fontSize: 14,
    color: '#22C55E',
    marginRight: 6,
    fontWeight: '500',
  },
  removeInterestButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsContent: {
    padding: 20,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  settingsItemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingsItemText: {
    fontSize: 16,
    color: '#333333',
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 15,
    marginTop: 30,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noInterestsText: {
    color: '#999',
    fontStyle: 'italic',
  },
  noReviewsText: {
    color: '#999',
    fontStyle: 'italic',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bottomPadding: {
    height: 20, // Add padding at the bottom for better scrolling experience
  },
});