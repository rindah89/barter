import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { uploadProfileAvatar } from '../../services/imageservice';

interface SimpleAvatarUploaderProps {
  onImageSelected?: (uri: string) => void;
  onUploadComplete?: (url: string) => void;
  onUploadError?: (error: Error) => void;
  defaultImage?: string | null;
  storageReady?: boolean;
}

export default function SimpleAvatarUploader({
  onImageSelected,
  onUploadComplete,
  onUploadError,
  defaultImage,
  storageReady = true
}: SimpleAvatarUploaderProps) {
  const [avatarUri, setAvatarUri] = useState<string | null>(defaultImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();
  
  // Function to pick an image
  const pickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission required', 'We need permission to access your photos');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Lower quality for smaller file size
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setAvatarUri(selectedUri);
        
        if (onImageSelected) {
          onImageSelected(selectedUri);
        }
      }
    } catch (err) {
      console.error('Error selecting image:', err);
      Alert.alert('Error', 'Could not select image');
    }
  };
  
  // Upload avatar using the new imageservice
  const uploadAvatar = async () => {
    if (!avatarUri || !user) {
      Alert.alert('Error', 'No image selected or not logged in');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(10);
      
      // Simple check if file exists
      const fileInfo = await FileSystem.getInfoAsync(avatarUri);
      if (!fileInfo.exists) {
        throw new Error('Image file not found');
      }
      
      setUploadProgress(30);
      
      // Use the new uploadProfileAvatar function from imageservice
      console.log(`Uploading avatar for user: ${user.id}`);
      setUploadProgress(50);
      
      const uploadResult = await uploadProfileAvatar(user.id, avatarUri);
      
      setUploadProgress(90);
      
      if (!uploadResult.success) {
        console.error('Upload failed:', uploadResult.error);
        throw new Error(uploadResult.error || 'Failed to upload avatar');
      }
      
      setUploadProgress(100);
      setIsUploading(false);
      
      if (uploadResult.url && onUploadComplete) {
        onUploadComplete(uploadResult.url);
      }
      
      return uploadResult.url;
    } catch (err) {
      console.error('Avatar upload error:', err);
      setIsUploading(false);
      setUploadProgress(0);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Upload Error', `Could not upload avatar: ${errorMessage}`);
      
      if (onUploadError && err instanceof Error) {
        onUploadError(err);
      }
      
      return null;
    }
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text style={styles.placeholderText}>Select Image</Text>
          </View>
        )}
      </TouchableOpacity>
      
      {isUploading ? (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          <Text style={styles.progressText}>{uploadProgress}%</Text>
          <ActivityIndicator size="small" color="#4CD964" style={styles.progressIndicator} />
        </View>
      ) : (
        avatarUri && (
          <TouchableOpacity 
            style={[styles.uploadButton, !storageReady && styles.uploadButtonDisabled]} 
            onPress={uploadAvatar}
            disabled={isUploading || !storageReady}
          >
            <Text style={styles.uploadButtonText}>
              {storageReady ? 'Upload Image' : 'Storage Not Ready'}
            </Text>
          </TouchableOpacity>
        )
      )}
      
      {!storageReady && avatarUri && (
        <Text style={styles.errorText}>
          Storage configuration is not ready. Please try again later.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  placeholderText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressContainer: {
    width: '80%',
    height: 20,
    backgroundColor: '#E5E5E5',
    borderRadius: 10,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CD964',
  },
  progressText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  progressIndicator: {
    position: 'absolute',
    right: 5,
    top: 0,
    bottom: 0,
  },
  uploadButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
}); 