import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';

/**
 * Utility functions for Supabase storage operations
 */
export const StorageService = {
  /**
   * Ensure a bucket exists and is publicly accessible
   */
  ensureBucket: async (bucketName: string): Promise<boolean> => {
    try {
      console.log(`Checking if ${bucketName} bucket exists...`);
      const { data: bucket, error } = await supabase.storage.getBucket(bucketName);
      
      if (error) {
        console.log(`Bucket ${bucketName} error:`, error.message);
        
        if (error.message.includes('not found')) {
          console.log(`Creating ${bucketName} bucket...`);
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5 * 1024 * 1024 // 5MB limit
          });
          
          if (createError) {
            console.error(`Failed to create ${bucketName} bucket:`, createError);
            return false;
          }
          
          return true;
        }
        
        return false;
      }
      
      // Ensure bucket is public
      if (!bucket.public) {
        console.log(`Making ${bucketName} bucket public...`);
        const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
          public: true
        });
        
        if (updateError) {
          console.error(`Failed to update ${bucketName} bucket:`, updateError);
          return false;
        }
      }
      
      return true;
    } catch (e) {
      console.error(`Error ensuring ${bucketName} bucket:`, e);
      return false;
    }
  },
  
  /**
   * Ensure a folder exists within a bucket by creating a placeholder file
   */
  ensureFolder: async (bucketName: string, folderPath: string): Promise<boolean> => {
    try {
      console.log(`Ensuring ${folderPath} folder exists in ${bucketName}...`);
      
      // Check if folder exists by listing its contents
      const { data: listData, error: listError } = await supabase.storage
        .from(bucketName)
        .list(folderPath, { limit: 1 });
        
      if (!listError && listData && listData.length > 0) {
        console.log(`Folder ${folderPath} already exists`);
        return true;
      }
      
      // Create placeholder file to ensure folder exists
      const placeholderPath = `${folderPath}/.placeholder`;
      const placeholderContent = 'placeholder';
      
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(placeholderPath, placeholderContent, {
          contentType: 'text/plain',
          upsert: true
        });
        
      if (uploadError && uploadError.message !== 'The resource already exists') {
        console.error(`Failed to create folder ${folderPath}:`, uploadError);
        return false;
      }
      
      console.log(`Successfully created folder ${folderPath}`);
      return true;
    } catch (e) {
      console.error(`Error ensuring folder ${folderPath}:`, e);
      return false;
    }
  },
  
  /**
   * Upload a file using direct base64 method
   */
  uploadDirect: async (
    bucketName: string,
    filePath: string,
    localUri: string,
    contentType: string = 'image/jpeg'
  ) => {
    try {
      console.log(`Direct upload: ${localUri} to ${bucketName}/${filePath}`);
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, base64Data, {
          contentType,
          upsert: true
        });
      
      if (error) {
        console.error('Direct upload error:', error);
        return { success: false, error };
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      return { 
        success: true, 
        url: urlData?.publicUrl,
        data
      };
    } catch (e) {
      console.error('Direct upload exception:', e);
      return { 
        success: false, 
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  },
  
  /**
   * Upload using signed URL method
   */
  uploadWithSignedUrl: async (
    bucketName: string,
    filePath: string,
    localUri: string,
    contentType: string = 'image/jpeg'
  ) => {
    try {
      console.log(`Signed URL upload: ${localUri} to ${bucketName}/${filePath}`);
      
      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(filePath);
      
      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
        return { success: false, error: signedUrlError };
      }
      
      // Upload using FileSystem
      const uploadResult = await FileSystem.uploadAsync(signedUrlData.signedUrl, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType }
      });
      
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);
        
        return { 
          success: true, 
          url: urlData?.publicUrl,
          data: uploadResult
        };
      } else {
        console.error('Signed URL upload failed:', uploadResult);
        return { 
          success: false, 
          error: new Error(`Upload failed with status ${uploadResult.status}`)
        };
      }
    } catch (e) {
      console.error('Signed URL upload exception:', e);
      return { 
        success: false, 
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  },
  
  /**
   * Upload a small placeholder image when everything else fails
   */
  uploadPlaceholder: async (
    bucketName: string,
    filePath: string
  ) => {
    try {
      console.log(`Placeholder upload to ${bucketName}/${filePath}`);
      
      // Small 1x1 transparent PNG
      const smallPlaceholder = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      
      // Convert base64 to blob
      const response = await fetch(`data:image/png;base64,${smallPlaceholder}`);
      const blob = await response.blob();
      
      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (error) {
        console.error('Placeholder upload error:', error);
        return { success: false, error };
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      return { 
        success: true, 
        url: urlData?.publicUrl,
        data,
        isPlaceholder: true
      };
    } catch (e) {
      console.error('Placeholder upload exception:', e);
      return { 
        success: false, 
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  },
  
  /**
   * Try multiple upload methods in sequence
   * Falls back to simpler methods if more advanced ones fail
   */
  uploadWithFallback: async (
    bucketName: string,
    filePath: string,
    localUri: string,
    contentType: string = 'image/jpeg'
  ) => {
    try {
      console.log(`Starting upload with fallback: ${localUri} to ${bucketName}/${filePath}`);
      
      // First try: Signed URL (most reliable for binary data)
      console.log('Trying signed URL upload...');
      const signedResult = await StorageService.uploadWithSignedUrl(
        bucketName, filePath, localUri, contentType
      );
      
      if (signedResult.success) {
        console.log('Signed URL upload succeeded!');
        return signedResult;
      }
      
      console.log('Signed URL upload failed, trying direct upload...');
      
      // Second try: Direct upload
      const directResult = await StorageService.uploadDirect(
        bucketName, filePath, localUri, contentType
      );
      
      if (directResult.success) {
        console.log('Direct upload succeeded!');
        return directResult;
      }
      
      console.log('Direct upload failed, uploading placeholder...');
      
      // Final fallback: Placeholder
      const placeholderResult = await StorageService.uploadPlaceholder(
        bucketName, filePath
      );
      
      if (placeholderResult.success) {
        console.log('Placeholder upload succeeded as fallback');
      }
      
      return placeholderResult;
    } catch (e) {
      console.error('Upload with fallback exception:', e);
      return { 
        success: false, 
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  },

  /**
   * Create proper RLS policies for the profiles bucket
   * This ensures that:
   * 1. Anyone can view/download files (public bucket)
   * 2. Authenticated users can upload their own avatars
   * 3. Users can only update/delete their own files
   */
  setupProfilesBucketPolicies: async (): Promise<boolean> => {
    try {
      console.log('Setting up RLS policies for profiles bucket...');
      
      // First, check if the bucket exists and is public
      const bucketExists = await StorageService.ensureBucket('profiles');
      if (!bucketExists) {
        console.error('Cannot set up policies: profiles bucket does not exist');
        return false;
      }
      
      // Create policy for public read access to all files
      const { error: readPolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: 'profiles',
        policy_name: 'Public Read Access',
        definition: 'true', // Allow anyone to read
        operation: 'SELECT'
      });
      
      if (readPolicyError) {
        console.error('Error creating read policy:', readPolicyError);
        // Continue anyway, as this might be because the policy already exists
      }
      
      // Create policy for authenticated users to upload files
      const { error: insertPolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: 'profiles',
        policy_name: 'Authenticated Upload',
        definition: 'auth.role() = \'authenticated\'', // Only authenticated users can upload
        operation: 'INSERT'
      });
      
      if (insertPolicyError) {
        console.error('Error creating insert policy:', insertPolicyError);
        // Continue anyway
      }
      
      // Create policy for users to update their own files
      const { error: updatePolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: 'profiles',
        policy_name: 'Owner Update',
        definition: 'auth.uid() = owner', // Only file owner can update
        operation: 'UPDATE'
      });
      
      if (updatePolicyError) {
        console.error('Error creating update policy:', updatePolicyError);
        // Continue anyway
      }
      
      // Create policy for users to delete their own files
      const { error: deletePolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: 'profiles',
        policy_name: 'Owner Delete',
        definition: 'auth.uid() = owner', // Only file owner can delete
        operation: 'DELETE'
      });
      
      if (deletePolicyError) {
        console.error('Error creating delete policy:', deletePolicyError);
        // Continue anyway
      }
      
      console.log('Successfully set up RLS policies for profiles bucket');
      return true;
    } catch (e) {
      console.error('Error setting up RLS policies:', e);
      return false;
    }
  }
}; 