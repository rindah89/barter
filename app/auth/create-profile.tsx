import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Image, Dimensions, Button } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/dbHelpers';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import SimpleImagePicker from '../components/SimpleImagePicker';
import SimpleAvatarUploader from '../components/SimpleAvatarUploader';
import { uploadProfileAvatar } from '../../services/imageservice';

const { width, height } = Dimensions.get('window');

// Background decorative component
const BackgroundShapes = () => {
  return (
    <View style={styles.backgroundContainer}>
      {/* Top left circle */}
      <View style={[styles.shape, styles.circle, styles.topLeftCircle]} />
      
      {/* Top right oval */}
      <View style={[styles.shape, styles.oval, styles.topRightOval]} />
      
      {/* Middle left leaf shape */}
      <View style={[styles.shape, styles.leaf, styles.middleLeftLeaf]} />
      
      {/* Middle of screen circle */}
      <View style={[styles.shape, styles.circle, styles.midCircle]} />
      
      {/* Left center oval - green */}
      <View style={[styles.shape, styles.oval, styles.leftCenterOval]} />
      
      {/* Right center triangle - green */}
      <View style={[styles.shape, styles.triangle, styles.rightCenterTriangle]} />
      
      {/* Bottom left small circle */}
      <View style={[styles.shape, styles.circle, styles.bottomLeftCircle]} />
      
      {/* Bottom right blob */}
      <View style={[styles.shape, styles.blob, styles.bottomRightBlob]} />
      
      {/* Small dots */}
      <View style={[styles.shape, styles.dot, styles.dot1]} />
      <View style={[styles.shape, styles.dot, styles.dot2]} />
      <View style={[styles.shape, styles.dot, styles.dot3]} />
      <View style={[styles.shape, styles.dot, styles.dot4]} />
      <View style={[styles.shape, styles.dot, styles.dot5]} />
    </View>
  );
};

export default function CreateProfileScreen() {
  const { user, session } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // Check if user already has a profile and set up storage
    if (user) {
      const setupStorage = async () => {
        try {
          // Check if the Supabase storage is accessible
          const { data, error } = await supabase.storage.getBucket('profiles');
          
          if (error && !error.message.includes('not found')) {
            console.error('Storage access error:', error);
            setError('Storage configuration error. Please try again later.');
            setStorageReady(false);
          } else {
            // Storage is accessible
            setStorageReady(true);
          }
        } catch (err) {
          console.error('Storage setup error:', err);
          setError('Storage configuration error. Please try again later.');
          setStorageReady(false);
        }
      };
      
      checkExistingProfile();
      setupStorage();
    }
  }, [user]);

  useEffect(() => {
    // Log MediaTypeOptions to check its value
    console.log('ImagePicker.MediaTypeOptions:', ImagePicker.MediaTypeOptions);
    console.log('ImagePicker.MediaTypeOptions.Images:', ImagePicker.MediaTypeOptions.Images);
  }, []);

  const checkExistingProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('name, bio, location, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        throw error;
      }
      
      if (data) {
        console.log('Existing profile found:', data);
        setName(data.name || '');
        setBio(data.bio || '');
        setLocation(data.location || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (err) {
      console.error('Error checking profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {

    
    try {
      // Use the standard constants from the ImagePicker API
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      
      console.log('Image picker result received:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Setting avatar URI to:', result.assets[0].uri);
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('ERROR IN PICK IMAGE:', err);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarUri || !user) return null;

    try {
      setImageUploading(true);
      console.log('Starting avatar upload process for user:', user.id);
      
      // Use the new uploadProfileAvatar function from imageservice
      const uploadResult = await uploadProfileAvatar(user.id, avatarUri);
      
      if (!uploadResult.success) {
        console.error('Upload failed:', uploadResult.error);
        throw new Error(uploadResult.error || 'Failed to upload avatar');
      }
      
      console.log('Upload successful, public URL:', uploadResult.url);
      return uploadResult.url || null;
    } catch (err: unknown) {
      console.error('Avatar upload error:', err);
      if (err instanceof Error) {
        Alert.alert('Upload Error', `Could not upload avatar: ${err.message}`);
      } else {
        Alert.alert('Upload Error', 'Could not upload avatar due to an unknown error');
      }
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!user) return;
    
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    try {
      setLoading(true);
      
      // Upload the avatar image if one is selected
      let profileAvatarUrl = null;
      if (avatarUri) {
        profileAvatarUrl = await uploadAvatar();
        if (profileAvatarUrl) {
          setAvatarUrl(profileAvatarUrl);
        }
      }
      
      // Create profile with the avatar URL
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name,
        bio,
        location,
        avatar_url: profileAvatarUrl || avatarUrl, // Use the newly uploaded URL or existing one
        updated_at: new Date().toISOString()
      });
      
      if (error) {
        throw error;
      }
      
      console.log('Profile created/updated successfully');
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error creating profile:', err.message);
        Alert.alert('Error', `Failed to create profile: ${err.message}`);
      } else {
        console.error('Unknown error creating profile:', err);
        Alert.alert('Error', 'An unknown error occurred while creating your profile');
      }
    } finally {
      setLoading(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !loading) {
      router.replace('/auth/login');
    }
  }, [session, loading]);

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background decorative shapes */}
      <BackgroundShapes />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled
      >
        <ScrollView 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled" // Important to ensure touches work with keyboard open
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Tell others about yourself to get started</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.avatarContainer}>
              {/* Clickable avatar area with camera icon */}
              <SimpleAvatarUploader
                onImageSelected={(uri: string) => setAvatarUri(uri)}
                onUploadComplete={(url: string) => {
                  setAvatarUrl(url);
                }}
                onUploadError={(error: Error) => {
                  setError('Failed to upload avatar');
                }}
                storageReady={storageReady}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#A0A0A0"
                testID="name-input"
                editable={true}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about yourself and what items you're interested in trading"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#A0A0A0"
                testID="bio-input"
                editable={true}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, State/Province"
                placeholderTextColor="#A0A0A0"
                testID="location-input"
                editable={true}
              />
            </View>

            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={() => {
                console.log('Create Profile button pressed');
                handleCreateProfile();
              }}
              disabled={loading}
              testID="create-profile-button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    position: 'relative',
    zIndex: 5,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 20,
    position: 'relative',
    zIndex: 10,
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 2,
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  shape: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  circle: {
    borderRadius: 999,
  },
  oval: {
    borderRadius: 999,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 50,
    borderRightWidth: 50,
    borderBottomWidth: 100,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '30deg' }],
  },
  leaf: {
    borderRadius: 999,
    transform: [{ rotate: '45deg' }],
  },
  blob: {
    borderRadius: 60,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(161, 221, 241, 0.7)',
  },
  topLeftCircle: {
    width: width * 0.4,
    height: width * 0.4,
    top: -width * 0.2,
    left: -width * 0.2,
    backgroundColor: 'rgba(13, 172, 224, 0.3)',
  },
  topRightOval: {
    width: width * 0.5,
    height: width * 0.3,
    top: width * 0.05,
    right: -width * 0.25,
    backgroundColor: 'rgba(88, 192, 226, 0.25)',
  },
  midCircle: {
    width: width * 0.15,
    height: width * 0.15,
    top: height * 0.45,
    right: width * 0.15,
    backgroundColor: 'rgba(173, 216, 230, 0.35)',
  },
  middleLeftLeaf: {
    width: width * 0.25,
    height: width * 0.25,
    left: -width * 0.12,
    top: height * 0.3,
    backgroundColor: 'rgba(108, 194, 223, 0.35)',
  },
  leftCenterOval: {
    width: width * 0.25,
    height: width * 0.15,
    left: width * 0.1,
    top: height * 0.55,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',  // Green with opacity
    transform: [{ rotate: '-15deg' }],
  },
  rightCenterTriangle: {
    right: -width * 0.05,
    top: height * 0.65,
    borderBottomColor: 'rgba(37, 207, 100, 0.20)', // Green with opacity
  },
  bottomLeftCircle: {
    width: width * 0.2,
    height: width * 0.2,
    bottom: height * 0.15,
    left: width * 0.07,
    backgroundColor: 'rgba(173, 216, 230, 0.3)',
  },
  bottomRightBlob: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: -width * 0.3,
    right: -width * 0.3,
    backgroundColor: 'rgba(173, 216, 230, 0.25)',
    transform: [{ rotate: '20deg' }],
  },
  dot1: {
    top: height * 0.15,
    right: width * 0.2,
  },
  dot2: {
    top: height * 0.25,
    left: width * 0.25,
  },
  dot3: {
    bottom: height * 0.2,
    left: width * 0.1,
  },
  dot4: {
    top: height * 0.4,
    right: width * 0.4,
  },
  dot5: {
    bottom: height * 0.3,
    right: width * 0.3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPlaceholderContainer: {
    position: 'relative', 
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#F9F9F9',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    minHeight: 120,
  },
  createButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    backgroundColor: '#A0A0A0',
    shadowOpacity: 0,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTouchArea: {
    alignItems: 'center',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 999,
  },
  avatarHelperText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
}); 