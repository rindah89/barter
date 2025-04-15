import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import AuthWrapper from '../components/AuthWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStatus from '../hooks/useAuthStatus';

/**
 * This is a protected page that requires authentication
 * It uses the AuthWrapper to check if the user is authenticated
 */
export default function ProtectedScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user, profile, refreshUserData } = useAuthStatus();

  return (
    <AuthWrapper
      authRequired={true}
      fallback={
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ title: 'Authentication Required' }} />
          <View style={styles.content}>
            <Text style={styles.title}>Authentication Required</Text>
            <Text style={styles.message}>
              You need to be logged in to view this page.
            </Text>
            <Button 
              title="Go to Welcome" 
              onPress={() => router.push('/welcome')} 
            />
          </View>
        </SafeAreaView>
      }
    >
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Protected Page' }} />
        <View style={styles.content}>
          <Text style={styles.title}>Protected Content</Text>
          <Text style={styles.subtitle}>You are logged in!</Text>
          
          <View style={styles.userInfo}>
            <Text style={styles.userInfoTitle}>User Information:</Text>
            {user && (
              <>
                <Text style={styles.userInfoText}>Email: {user.email}</Text>
                <Text style={styles.userInfoText}>
                  Email Verified: {user.email_confirmed_at ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.userInfoText}>
                  Created: {new Date(user.created_at).toLocaleString()}
                </Text>
              </>
            )}
            
            {profile && (
              <>
                <Text style={styles.userInfoTitle}>Profile Information:</Text>
                <Text style={styles.userInfoText}>Name: {profile.name || 'Not set'}</Text>
                {profile.avatar_url && (
                  <Text style={styles.userInfoText}>Has Avatar: Yes</Text>
                )}
              </>
            )}
          </View>
          
          <View style={styles.buttonContainer}>
            <Button 
              title="Refresh User Data" 
              onPress={refreshUserData} 
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <Button 
              title="Go to Debug Screen" 
              onPress={() => router.push('/debug')} 
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <Button 
              title="Sign Out" 
              onPress={async () => {
                await signOut();
                router.replace('/auth/sign-in');
              }} 
              color="#EF4444"
            />
          </View>
        </View>
      </SafeAreaView>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
    color: '#22C55E',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  userInfo: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 12,
    color: '#333',
  },
  userInfoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  buttonContainer: {
    marginVertical: 5,
    width: '80%',
  },
}); 