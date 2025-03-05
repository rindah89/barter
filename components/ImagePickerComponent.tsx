import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type ImagePickerProps = {
  imageUrl: string | null;
  onImageSelected: (url: string) => void;
  placeholder?: string;
};

export default function ImagePickerComponent({ 
  imageUrl, 
  onImageSelected,
  placeholder = 'https://images.unsplash.com/photo-1563203369-26f2e4a5ccf7?q=80&w=600&auto=format&fit=crop'
}: ImagePickerProps) {
  const { userId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    setError(null);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate a unique file name
      const fileExt = uri.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      onImageSelected(data.publicUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: imageUrl || placeholder }} 
        style={styles.image} 
      />
      
      <TouchableOpacity 
        style={styles.cameraButton}
        onPress={pickImage}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Camera color="#FFFFFF" size={24} />
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    color: '#FFFFFF',
    padding: 5,
    fontSize: 12,
    textAlign: 'center',
  },
});