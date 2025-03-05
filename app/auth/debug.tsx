import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { diagnosePossibleSupabaseIssues, checkAuthTriggers, syncProfilesWithAuth } from '../../lib/dbHelpers';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import SimpleAvatarUploader from '../components/SimpleAvatarUploader';

export default function DebugScreen() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Add any initialization code here
    
    // Run diagnostics when the component mounts
    if (autoRun) {
      runDiagnostics();
    }
  }, []);

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      setResults(null);
      
      console.log('Running diagnostics...');
      
      // Test 1: Basic Auth Endpoint
      console.log('Testing auth endpoint...');
      const authEndpointResult = await testAuthEndpoint();
      
      // Test 2: Auth Triggers
      console.log('Testing auth triggers...');
      const authTriggerResult = await testAuthTrigger();
      
      // Test 3: Profile Sync
      console.log('Testing profile sync...');
      const profileSyncResult = await testProfileSync();
      
      // Test 4: Storage Connectivity
      console.log('Testing storage connectivity...');
      const storageResult = await testStorageConnectivity();
      
      // Test 5: Avatar Upload
      console.log('Testing avatar upload...');
      const avatarUploadResult = await testAvatarUpload();
      
      // Compile all results
      const allResults = {
        authEndpoint: authEndpointResult,
        authTrigger: authTriggerResult,
        profileSync: profileSyncResult,
        storage: storageResult,
        avatarUpload: avatarUploadResult
      };
      
      setResults({ tests: allResults });
      console.log('Diagnostics complete:', allResults);
    } catch (err) {
      console.error('Error running diagnostics:', err);
      setError(`Error running diagnostics: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to test the authentication endpoint
  const testAuthEndpoint = async () => {
    try {
      console.log('Testing authentication endpoint...');
      const start = Date.now();
      
      // Test the auth endpoint with a simple operation
      const { data, error } = await supabase.auth.getSession();
      
      const statusResult = {
        success: !error,
        error: error ? error.message : null,
        elapsed: `${Date.now() - start}ms`
      };
      
      // If there's a response, include it in the result
      const responseBody = {
        hasSession: !!data?.session,
        sessionExpiry: data?.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
      };
      
      return {
        ...statusResult,
        response: responseBody,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('Auth endpoint test error:', err);
      return {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  };

  // Function to test if the auth trigger is working
  const testAuthTrigger = async () => {
    try {
      console.log('Testing authentication trigger...');
      
      const triggerResults = await checkAuthTriggers();
      
      return {
        ...triggerResults,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('Auth trigger test error:', err);
      return {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  };

  // Function to test synchronizing profiles with auth users
  const testProfileSync = async () => {
    try {
      console.log('Testing profile synchronization...');
      
      const syncResults = await syncProfilesWithAuth();
      
      return {
        ...syncResults,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('Profile sync error:', err);
      return {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  };

  // Test storage connectivity specifically
  const testStorageConnectivity = async () => {
    setLoading(true);
    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: {}
      };

      // Test 1: Basic storage connectivity
      try {
        console.log('Testing basic storage connectivity...');
        const start = Date.now();
        
        // Try to list buckets
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        const elapsed = Date.now() - start;
        
        results.tests.listBuckets = {
          success: !bucketsError,
          elapsed: `${elapsed}ms`,
          buckets: bucketsError ? null : buckets.map(b => b.name),
          error: bucketsError ? bucketsError.message : null
        };
      } catch (err: any) {
        results.tests.listBuckets = {
          success: false,
          error: err.message
        };
      }

      // Test 2: Profiles bucket access
      try {
        console.log('Testing profiles bucket access...');
        const start = Date.now();
        
        // Try to access the profiles bucket
        const { data: files, error: filesError } = await supabase.storage
          .from('profiles')
          .list('', { limit: 5 });
        
        const elapsed = Date.now() - start;
        
        results.tests.profilesBucket = {
          success: !filesError,
          elapsed: `${elapsed}ms`,
          fileCount: filesError ? null : files.length,
          error: filesError ? filesError.message : null
        };
      } catch (err: any) {
        results.tests.profilesBucket = {
          success: false,
          error: err.message
        };
      }

      // Test 2.5: Check avatars folder
      try {
        console.log('Testing avatars folder...');
        const start = Date.now();
        
        // Try to access the avatars folder
        const { data: avatarFiles, error: avatarError } = await supabase.storage
          .from('profiles')
          .list('avatars', { limit: 5 });
        
        const folderExists = !avatarError;
        
        // If folder doesn't exist, try to create it
        if (!folderExists) {
          console.log('Avatars folder not found, creating it...');
          
          // Create a placeholder file to establish the folder
          const placeholderContent = new Blob([''], { type: 'text/plain' });
          const { error: createError } = await supabase.storage
            .from('profiles')
            .upload('avatars/.placeholder', placeholderContent);
          
          if (createError && !createError.message.includes('already exists')) {
            console.error('Failed to create avatars folder:', createError);
          } else {
            console.log('Successfully created avatars folder');
          }
          
          // Check if folder now exists
          const { data: recheckFiles, error: recheckError } = await supabase.storage
            .from('profiles')
            .list('avatars', { limit: 5 });
          
          results.tests.avatarsFolder = {
            initialCheck: 'Folder not found',
            creationAttempt: !createError ? 'Success' : `Failed: ${createError.message}`,
            recheck: !recheckError ? 'Success' : `Failed: ${recheckError.message}`,
            elapsed: `${Date.now() - start}ms`,
          };
        } else {
          results.tests.avatarsFolder = {
            initialCheck: 'Folder exists',
            fileCount: avatarFiles.length,
            elapsed: `${Date.now() - start}ms`,
          };
        }
      } catch (err: any) {
        results.tests.avatarsFolder = {
          success: false,
          error: err.message
        };
      }

      // Test 3: Direct HTTP fetch to storage endpoint
      try {
        console.log('Testing direct HTTP fetch to storage endpoint...');
        const start = Date.now();
        
        const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        });
        
        const elapsed = Date.now() - start;
        
        // Try to parse the response
        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (parseErr) {
          console.log('Could not parse response as JSON');
        }
        
        results.tests.httpStorageFetch = {
          success: response.ok,
          elapsed: `${elapsed}ms`,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseBody
        };
      } catch (err: any) {
        results.tests.httpStorageFetch = {
          success: false,
          error: err.message
        };
      }
      
      // Test 4: Try a small test upload
      try {
        console.log('Testing small file upload...');
        const start = Date.now();
        
        // Create a small test file
        const testData = JSON.stringify({ test: true, timestamp: Date.now() });
        const jsonBlob = new Blob([testData], { type: 'application/json' });
        
        console.log('JSON blob created, size:', jsonBlob.size, 'bytes');
        
        // Try to upload to the profiles bucket
        const jsonPath = `test-${Date.now()}.json`;
        console.log('Attempting JSON upload to path:', jsonPath);
        const { data: jsonData, error: jsonError } = await supabase.storage
          .from('profiles')
          .upload(jsonPath, jsonBlob);
        
        if (jsonError) {
          console.error('JSON upload error:', jsonError.message);
          console.error('Error details:', JSON.stringify(jsonError));
        } else {
          console.log('JSON upload successful:', jsonData);
        }
        
        // Now try a small image upload to the avatars folder
        // Create a 1x1 pixel transparent PNG (minimal image)
        console.log('Creating test image...');
        const base64Img = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const byteCharacters = atob(base64Img);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: 'image/png' });
        
        console.log('Image blob created, size:', imageBlob.size, 'bytes');
        
        // Try to upload to the avatars folder
        const imagePath = `avatars/test-image-${Date.now()}.png`;
        console.log('Attempting image upload to path:', imagePath);
        
        // Try standard upload first
        console.log('Trying standard upload method...');
        const { data: imageData, error: imageError } = await supabase.storage
          .from('profiles')
          .upload(imagePath, imageBlob);
        
        if (imageError) {
          console.error('Image upload error:', imageError.message);
          console.error('Error details:', JSON.stringify(imageError));
          
          // Try alternative upload method with fetch API directly
          console.log('Trying alternative upload method with fetch API...');
          try {
            // Get the presigned URL for upload
            const { data: urlData, error: urlError } = await supabase.storage
              .from('profiles')
              .createSignedUploadUrl(imagePath);
              
            if (urlError) {
              console.error('Failed to get signed URL:', urlError.message);
            } else if (urlData) {
              console.log('Got signed URL:', urlData.signedUrl);
              
              // Try to upload using the signed URL with fetch
              const fetchResponse = await fetch(urlData.signedUrl, {
                method: 'PUT',
                body: imageBlob,
                headers: {
                  'Content-Type': 'image/png'
                }
              });
              
              if (fetchResponse.ok) {
                console.log('Fetch upload successful!', fetchResponse.status);
                // Update results to indicate success with alternative method
                results.tests.testUpload = {
                  jsonUpload: {
                    success: !jsonError,
                    path: jsonError ? null : jsonPath,
                    error: jsonError ? jsonError.message : null
                  },
                  imageUpload: {
                    success: !imageError,
                    path: imageError ? null : imagePath,
                    error: imageError ? imageError.message : null
                  },
                  elapsed: `${Date.now() - start}ms`
                };
              } else {
                console.error('Fetch upload failed:', fetchResponse.status, await fetchResponse.text());
              }
            }
          } catch (fetchErr) {
            console.error('Fetch upload error:', fetchErr.message);
          }
        } else {
          console.log('Image upload successful:', imageData);
        }
        
        const elapsed = Date.now() - start;
        
        results.tests.testUpload = {
          jsonUpload: {
            success: !jsonError,
            path: jsonError ? null : jsonPath,
            error: jsonError ? jsonError.message : null
          },
          imageUpload: {
            success: !imageError,
            path: imageError ? null : imagePath,
            error: imageError ? imageError.message : null
          },
          elapsed: `${elapsed}ms`
        };
        
        // If JSON upload was successful, try to get the URL and then delete the test file
        if (!jsonError && jsonData) {
          const { data: jsonUrlData } = supabase.storage
            .from('profiles')
            .getPublicUrl(jsonPath);
          
          results.tests.testUpload.jsonUpload.publicUrl = jsonUrlData?.publicUrl;
          
          // Clean up by deleting the test file
          await supabase.storage
            .from('profiles')
            .remove([jsonPath]);
        }
        
        // If image upload was successful, try to get the URL and then delete the test file
        if (!imageError && imageData) {
          const { data: imageUrlData } = supabase.storage
            .from('profiles')
            .getPublicUrl(imagePath);
          
          results.tests.testUpload.imageUpload.publicUrl = imageUrlData?.publicUrl;
          
          // Clean up by deleting the test file
          await supabase.storage
            .from('profiles')
            .remove([imagePath]);
        }
      } catch (err: any) {
        console.error('Test upload overall error:', err.message, err.stack);
        results.tests.testUpload = {
          success: false,
          error: err.message,
          stack: err.stack
        };
      }

      setResults({
        ...results,
        storageTests: results
      });
    } catch (err: any) {
      setError(`Storage tests failed: ${err.message}`);
      console.error('Storage test error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Test avatar upload functionality
  const testAvatarUpload = async () => {
    const results = {
      success: false,
      error: null,
      details: {
        bucketExists: false,
        folderExists: false,
        uploadTest: false,
        uploadUrl: null
      }
    };
    
    try {
      // Step 1: Check if user is authenticated
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Step 2: Ensure profiles bucket exists
      console.log('Ensuring profiles bucket exists...');
      
      try {
        const { data: bucketsData, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          throw new Error(`Error listing buckets: ${bucketsError.message}`);
        }
        
        const profilesBucketExists = bucketsData.some(b => b.name === 'profiles');
        
        if (!profilesBucketExists) {
          console.log('Profiles bucket does not exist, creating it...');
          const { error: createError } = await supabase.storage.createBucket('profiles', {
            public: true
          });
          
          if (createError) {
            throw new Error(`Error creating profiles bucket: ${createError.message}`);
          }
        }
        
        results.details.bucketExists = true;
      } catch (err: any) {
        console.error('Error ensuring profiles bucket:', err);
        results.details.bucketExists = false;
        results.details.profilesBucketError = err.message;
      }
      
      // Step 3: Ensure avatars folder exists
      console.log('Ensuring avatars folder exists...');
      
      try {
        // Try to list files in the avatars folder
        const { data: folderData, error: folderError } = await supabase.storage
          .from('profiles')
          .list('avatars', { limit: 1 });
          
        // If there's an error or no data, the folder might not exist
        if (folderError || !folderData || folderData.length === 0) {
          console.log('Creating avatars folder...');
          
          // Create a placeholder file to establish the folder
          const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload('avatars/.placeholder', 'placeholder');
            
          if (uploadError && !uploadError.message.includes('already exists')) {
            throw new Error(`Error creating avatars folder: ${uploadError.message}`);
          }
        }
        
        results.details.folderExists = true;
      } catch (err: any) {
        console.error('Error ensuring avatars folder:', err);
        results.details.folderExists = false;
        results.details.folderError = err.message;
      }
      
      // Step 4: Try to upload a test file
      console.log('Testing file upload...');
      
      try {
        const testContent = 'This is a test file for avatar upload functionality';
        const testFileName = `avatars/test-${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(testFileName, testContent);
          
        if (uploadError) {
          throw new Error(`Error uploading test file: ${uploadError.message}`);
        }
        
        // Get a public URL for the file
        const { data: urlData } = await supabase.storage
          .from('profiles')
          .getPublicUrl(testFileName);
          
        results.details.uploadTest = true;
        results.details.uploadUrl = urlData?.publicUrl || null;
        
        // Clean up by deleting the test file
        await supabase.storage
          .from('profiles')
          .remove([testFileName]);
      } catch (err: any) {
        console.error('Error testing file upload:', err);
        results.details.uploadTest = false;
        results.details.uploadError = err.message;
      }
      
      // Set overall success based on all tests
      results.success = results.details.bucketExists && 
                        results.details.folderExists && 
                        results.details.uploadTest;
                        
      return results;
    } catch (err: any) {
      console.error('Avatar upload test error:', err);
      results.success = false;
      results.error = err.message;
      return results;
    }
  };

  // Test Supabase storage connection with detailed diagnostics
  const testSupabaseStorageConnection = async () => {
    console.log('Testing Supabase storage connection...');
    const results = {
      success: false,
      error: null,
      details: {
        cors: null,
        auth: null,
        bucketExists: null,
        createBucket: null,
        signedUrl: null,
        uploadTest: null
      }
    };
    
    try {
      const start = Date.now();
      
      // 1. Check if we can access the storage API at all
      console.log('1. Testing basic storage API access...');
      try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
          results.details.cors = `Failed: ${error.message}`;
        } else {
          results.details.cors = `Success: Retrieved ${buckets.length} buckets`;
        }
      } catch (e: any) {
        results.details.cors = `Exception: ${e.message}`;
      }
      
      // 2. Check if the profiles bucket exists
      console.log('2. Checking if profiles bucket exists...');
      try {
        const { data: bucket, error } = await supabase.storage.getBucket('profiles');
        if (error) {
          results.details.bucketExists = `Failed: ${error.message}`;
          
          // Try to create the bucket if it doesn't exist
          console.log('2b. Attempting to create profiles bucket...');
          try {
            const { data: createData, error: createError } = await supabase.storage.createBucket('profiles', {
              public: true,
              fileSizeLimit: 10 * 1024 * 1024 // 10MB
            });
            
            if (createError) {
              results.details.createBucket = `Failed: ${createError.message}`;
            } else {
              results.details.createBucket = 'Success: Bucket created';
            }
          } catch (e: any) {
            results.details.createBucket = `Exception: ${e.message}`;
          }
        } else {
          results.details.bucketExists = `Success: Found bucket, public: ${bucket.public}`;
        }
      } catch (e: any) {
        results.details.bucketExists = `Exception: ${e.message}`;
      }
      
      // 3. Try to generate a signed URL
      console.log('3. Testing signed URL generation...');
      try {
        const testPath = `test-${Date.now()}.txt`;
        const { data: urlData, error: urlError } = await supabase.storage
          .from('profiles')
          .createSignedUploadUrl(testPath);
          
        if (urlError) {
          results.details.signedUrl = `Failed: ${urlError.message}`;
        } else {
          results.details.signedUrl = `Success: Generated URL: ${urlData.signedUrl.substring(0, 30)}...`;
          
          // 4. Try to upload a tiny test file
          console.log('4. Testing tiny file upload...');
          try {
            const tinyContent = 'test';
            const uploadResponse = await fetch(urlData.signedUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'text/plain',
              },
              body: tinyContent
            });
            
            if (!uploadResponse.ok) {
              results.details.uploadTest = `Failed: HTTP ${uploadResponse.status} - ${uploadResponse.statusText}`;
            } else {
              results.details.uploadTest = 'Success: Test file uploaded!';
              
              // Try to cleanup the test file
              try {
                await supabase.storage.from('profiles').remove([testPath]);
                console.log('Test file removed');
              } catch (e) {
                console.log('Could not remove test file:', e);
              }
            }
          } catch (e: any) {
            results.details.uploadTest = `Exception: ${e.message || String(e)}`;
          }
        }
      } catch (e: any) {
        results.details.signedUrl = `Exception: ${e.message}`;
      }
      
      // Determine overall success
      const allSucceeded = Object.values(results.details).every(result => 
        result && result.startsWith('Success'));
      
      results.success = allSucceeded;
      if (!allSucceeded) {
        const failedTests = Object.entries(results.details)
          .filter(([_, value]) => !value || !value.startsWith('Success'))
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ');
        
        results.error = `Storage connection tests failed: ${failedTests}`;
      }
      
      const elapsed = Date.now() - start;
      results.details.elapsed = `${elapsed}ms`;
      
      return results;
    } catch (err: any) {
      console.error('Storage connection test error:', err);
      return {
        success: false,
        error: `Test failed: ${err.message || String(err)}`,
        details: results.details || {}
      };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Supabase Diagnostics</Text>
        <Text style={styles.subtitle}>Use this tool to troubleshoot Supabase connection issues</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={runDiagnostics}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Run General Diagnostics</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={testAuthEndpoint}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Test Auth Endpoint</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={testAuthTrigger}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Test Auth Triggers</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={testStorageConnectivity}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Test Storage Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]}
          onPress={async () => {
            setLoading(true);
            try {
              const syncResults = await testProfileSync();
              
              Alert.alert(
                'Sync Complete',
                syncResults.success 
                  ? `Checked ${syncResults.results?.checked || 0} profiles. Found ${syncResults.results?.missing_auth || 0} missing auth users.` 
                  : `Sync failed: ${syncResults.error}`
              );
              
              // Refresh diagnostics after sync
              runDiagnostics();
            } catch (err) {
              Alert.alert('Error', `Failed to sync profiles: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Fix Auth Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Registration</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Running diagnostics...</Text>
        </View>
      ) : results ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Diagnostic Results:</Text>
          <Text style={styles.resultText}>
            {JSON.stringify(results, null, 2)}
          </Text>
        </View>
      ) : null}

      {/* Add the detailed Storage Connection Test section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test 5: Detailed Storage Connection Test</Text>
        <Text style={styles.sectionDescription}>
          Tests Supabase storage connection with detailed diagnostics.
        </Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={async () => {
            setLoading(true);
            const storageResult = await testSupabaseStorageConnection();
            setResults({ tests: { storageConnectionTest: storageResult } });
            setLoading(false);
          }}
        >
          <Text style={styles.buttonText}>Run Storage Test</Text>
        </TouchableOpacity>
        
        {results?.tests?.storageConnectionTest && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>
              {results.tests.storageConnectionTest.success 
                ? '✅ All storage tests passed!' 
                : `❌ ${results.tests.storageConnectionTest.error}`
              }
            </Text>
            
            {Object.entries(results.tests.storageConnectionTest.details).map(([key, value]) => (
              <Text key={key} style={styles.detailText}>
                {key}: {value}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Add a new test section for the SimpleAvatarUploader */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test 6: Simple Avatar Uploader</Text>
        <Text style={styles.sectionDescription}>
          Test our simplified avatar uploader with direct upload.
        </Text>
        
        <SimpleAvatarUploader
          onImageSelected={(uri) => {
            console.log('Image selected:', uri);
          }}
          onUploadComplete={(url) => {
            console.log('Upload complete with URL:', url);
            Alert.alert('Success', `Avatar uploaded successfully. URL: ${url}`);
          }}
          onUploadError={(error) => {
            console.error('Upload error:', error);
            Alert.alert('Error', `Upload failed: ${error.message}`);
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
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
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#666666',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  dangerButton: {
    backgroundColor: '#FF6B6B',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionDescription: {
    color: '#666666',
  },
  button: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  resultText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 12,
    color: '#666666',
  },
}); 
