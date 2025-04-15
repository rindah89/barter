import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Animated,
  Dimensions,
  Easing
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { ensureUserProfile, getErrorMessage } from '../../lib/dbHelpers';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signIn } = useAuth();
  const [showDebugOption, setShowDebugOption] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Animation values
  const modalScaleAnim = useRef(new Animated.Value(0.8)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);

  // Animate modal when it appears
  useEffect(() => {
    if (showSuccessModal) {
      Animated.parallel([
        Animated.timing(modalScaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Play Lottie animation
      if (lottieRef.current) {
        setTimeout(() => {
          lottieRef.current?.play();
        }, 300);
      }
    } else {
      // Reset animations when modal is closed
      modalScaleAnim.setValue(0.8);
      modalOpacityAnim.setValue(0);
      if (lottieRef.current) {
        lottieRef.current.reset();
      }
    }
  }, [showSuccessModal]);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setShowDebugOption(false);

    try {
      // Sign up the user with Supabase Auth - with additional debugging
      console.log('Starting user registration with email:', email);
      
      // Making direct API call to Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });
      
      const user = data.user;
      
      console.log('Signup response (detailed):', JSON.stringify({ 
        user: user ? {
          id: user.id,
          email: user.email,
          emailConfirmed: user.email_confirmed_at != null,
          confirmed: user.confirmed_at != null,
          lastSignIn: user.last_sign_in_at,
          createdAt: user.created_at,
          userMetadata: user.user_metadata,
        } : 'No user returned', 
        error: signUpError ? signUpError.message : 'No error'
      }, null, 2));

      // Try to verify if we can directly create a user without email verification
      try {
        // Check if the admin API is available (it usually isn't in client apps)
        if (typeof supabase.auth.admin === 'object' && supabase.auth.admin !== null) {
          console.log('Admin API seems to be available, attempting direct user creation');
        } else {
          console.log('Admin API is not available in this environment - this is expected for client apps');
        }
      } catch (adminErr: any) {
        console.log('Error checking admin API:', adminErr.message);
      }

      if (signUpError) {
        console.error('Sign up error details:', signUpError);
        
        // Check for server error (500) or other issues that might indicate server problems
        if (signUpError.message && (
          signUpError.message.includes('500') || 
          signUpError.message.includes('server') ||
          signUpError.message.includes('internal')
        )) {
          setShowDebugOption(true);
        }
        
        setError(`Registration failed: ${signUpError.message}`);
        return;
      }

      if (!user) {
        setError('User registration failed. Please try again.');
        return;
      }

      // Create the initial profile using our helper function
      console.log('User created, now creating profile for user ID:', user.id);
      const { error: profileError } = await ensureUserProfile(user.id, { name, email });
      
      if (profileError) {
        console.error('Profile creation error details:', profileError);
        // Show a more user-friendly error message
        setError(`Profile creation failed: ${getErrorMessage(profileError)}`);
        return;
      }

      // If we have a session token, store it in AuthContext
      if (data.session?.access_token) {
        await signIn(data.session.access_token);
      }

      // Show success modal instead of Alert
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Registration error (full error):', err);
      
      // Show debug option for unexpected errors
      setShowDebugOption(true);
      setError(`Registration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    setShowSuccessModal(false);
    router.replace('/auth/create-profile');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logoipsum-225.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to start trading items</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                
                {showDebugOption && (
                  <TouchableOpacity
                    style={styles.debugButton}
                    onPress={() => router.push('/auth/debug')}
                  >
                    <Text style={styles.debugButtonText}>Run Diagnostics</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#A0A0A0"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#A0A0A0"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#A0A0A0"
                />
                <TouchableOpacity 
                  style={styles.passwordVisibilityButton}
                  onPress={togglePasswordVisibility}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off' : 'eye'} 
                    size={24} 
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  secureTextEntry={!showConfirmPassword}
                  placeholderTextColor="#A0A0A0"
                />
                <TouchableOpacity 
                  style={styles.passwordVisibilityButton}
                  onPress={toggleConfirmPasswordVisibility}
                >
                  <Ionicons 
                    name={showConfirmPassword ? 'eye-off' : 'eye'} 
                    size={24} 
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                opacity: modalOpacityAnim,
                transform: [{ scale: modalScaleAnim }]
              }
            ]}
          >
            <View style={styles.successIconContainer}>
              <LottieView
                ref={lottieRef}
                source={require('../../assets/animations/success-checkmark.json')}
                style={styles.lottieAnimation}
                autoPlay={false}
                loop={false}
              />
            </View>
            
            <Text style={styles.modalTitle}>Registration Successful!</Text>
            
            <Text style={styles.modalMessage}>
              Please check your email to confirm your account. Then complete your profile to start bartering!
            </Text>
            
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    marginTop: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
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
  registerButton: {
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
  registerButtonDisabled: {
    backgroundColor: '#A0A0A0',
    shadowOpacity: 0,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLink: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  passwordVisibilityButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 20,
    marginTop: 10,
  },
  lottieAnimation: {
    width: 120,
    height: 120,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  continueButton: {
    width: '100%',
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});