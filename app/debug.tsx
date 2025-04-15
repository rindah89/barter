import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ErrorDebugScreen, StandardErrorView, SafeErrorView, getErrorMessage, getErrorStack } from '../lib/ErrorUtils';
import { LogViewer, captureConsoleLogs } from '../lib/LogCapture';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStatus from '../hooks/useAuthStatus';
import { diagnoseAuthIssues } from '../lib/diagnosAuth';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getCurrentSession } from '../lib/ExpoAuthSession';

// Debug tabs
enum DebugTab {
  ERRORS = 'Errors',
  LOGS = 'Logs',
  ENV = 'Environment',
  AUTH = 'Auth Status',
}

const TEST_CASES = [
  { name: 'Undefined', value: undefined },
  { name: 'Null', value: null },
  { name: 'Empty object', value: {} },
  { name: 'Object without message', value: { foo: 'bar' } },
  { name: 'Object with undefined message', value: { message: undefined } },
  { name: 'Object with null message', value: { message: null } },
  { name: 'Error with message', value: new Error('Test error') },
  { name: 'String', value: 'Error string' },
  { name: 'Object with circular reference', value: (() => {
    const obj: any = {};
    obj.self = obj;
    return obj;
  })() },
];

export default function DebugScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DebugTab>(DebugTab.ERRORS);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [selectedTest, setSelectedTest] = useState<number | null>(null);
  const [showComponent, setShowComponent] = useState<'none' | 'standard' | 'safe'>('none');
  const [testResults, setTestResults] = useState<Array<{name: string, result: string, success: boolean}>>([]);
  const { status: authStatus, user, profile, lastChecked, refreshUserData } = useAuthStatus();
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any>(null);
  const { signIn, signOut, refreshToken } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Capture console logs when the component mounts
  useEffect(() => {
    captureConsoleLogs();
    
    // Collect environment variables
    const env: Record<string, string> = {};
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('EXPO_') || key.startsWith('REACT_NATIVE_')) {
        env[key] = process.env[key] || '';
      }
    });
    setEnvVars(env);
    
    // Force an error to test error logging
    try {
      console.log('[Debug] Debug screen mounted');
      console.info('[Debug] This is an info message');
      console.warn('[Debug] This is a warning message');
      
      // Uncomment to test error logging
      // throw new Error('Test error from debug screen');
    } catch (error) {
      console.error('[Debug] Error in debug screen:', error);
    }
  }, []);

  // Test getErrorMessage function
  const testGetErrorMessage = () => {
    const results = TEST_CASES.map(test => {
      try {
        const message = getErrorMessage(test.value);
        return {
          name: test.name,
          result: `Success: "${message}"`,
          success: true
        };
      } catch (e) {
        return {
          name: test.name,
          result: `Error: ${e instanceof Error ? e.message : String(e)}`,
          success: false
        };
      }
    });
    setTestResults(results);
  };

  // Test getErrorStack function
  const testGetErrorStack = () => {
    const results = TEST_CASES.map(test => {
      try {
        const stack = getErrorStack(test.value);
        return {
          name: test.name,
          result: `Success: ${stack ? 'Got stack trace' : 'No stack'}`,
          success: true
        };
      } catch (e) {
        return {
          name: test.name,
          result: `Error: ${e instanceof Error ? e.message : String(e)}`,
          success: false
        };
      }
    });
    setTestResults(results);
  };

  // Add this function in the component, near where other button handlers are defined:
  const testSessionManually = async () => {
    console.log('Testing session manually');
    
    try {
      // Test direct supabase session retrieval
      const { data: supabaseData, error: supabaseError } = await supabase.auth.getSession();
      console.log('Direct Supabase session test:', { 
        success: !!supabaseData?.session, 
        error: supabaseError?.message 
      });
      
      // Test through our helper
      const sessionFromHelper = await getCurrentSession();
      console.log('Session from helper:', { 
        success: !!sessionFromHelper, 
        sessionExists: !!sessionFromHelper 
      });
      
      alert(
        `Session Test Results:\n` +
        `Direct Supabase: ${supabaseData?.session ? '✅ Found' : '❌ Not found'}\n` +
        `Helper Function: ${sessionFromHelper ? '✅ Found' : '❌ Not found'}`
      );
    } catch (error) {
      console.error('Session test error:', error);
      alert(`Session test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case DebugTab.ERRORS:
        return <ErrorDebugScreen />;
      case DebugTab.LOGS:
        return <LogViewer />;
      case DebugTab.AUTH:
        return (
          <ScrollView style={styles.envContainer}>
            <Text style={styles.envTitle}>Authentication Status</Text>
            
            <View style={styles.envItem}>
              <Text style={styles.envKey}>Status</Text>
              <Text style={[
                styles.envValue,
                { 
                  color: 
                    authStatus === 'ready' ? '#22C55E' : 
                    authStatus === 'loading' || authStatus === 'profile_loading' ? '#F59E0B' : 
                    '#EF4444'
                }
              ]}>
                {authStatus}
              </Text>
            </View>
            
            <View style={styles.envItem}>
              <Text style={styles.envKey}>User Authenticated</Text>
              <Text style={styles.envValue}>
                {user ? 'Yes' : 'No'}
              </Text>
            </View>
            
            {user && (
              <>
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>User ID</Text>
                  <Text style={styles.envValue}>{user.id}</Text>
                </View>
                
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>Email</Text>
                  <Text style={styles.envValue}>{user.email || 'None'}</Text>
                </View>
                
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>Last Auth Provider</Text>
                  <Text style={styles.envValue}>{user.app_metadata?.provider || 'Unknown'}</Text>
                </View>
              </>
            )}
            
            <View style={styles.envItem}>
              <Text style={styles.envKey}>Profile Loaded</Text>
              <Text style={styles.envValue}>
                {profile ? 'Yes' : 'No'}
              </Text>
            </View>
            
            {profile && (
              <>
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>Profile Name</Text>
                  <Text style={styles.envValue}>{profile.name || 'Not set'}</Text>
                </View>
                
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>Created At</Text>
                  <Text style={styles.envValue}>
                    {profile.created_at ? new Date(profile.created_at).toLocaleString() : 'Unknown'}
                  </Text>
                </View>
              </>
            )}
            
            <View style={styles.envItem}>
              <Text style={styles.envKey}>Last Status Check</Text>
              <Text style={styles.envValue}>
                {lastChecked ? lastChecked.toLocaleString() : 'Never'}
              </Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <Button 
                title="Refresh User Data" 
                onPress={() => {
                  console.log('[Debug] Manually refreshing user data');
                  refreshUserData();
                }} 
              />
            </View>

            <Button 
              title="Run Auth Diagnostics" 
              onPress={async () => {
                console.log('[Debug] Running auth diagnostics');
                try {
                  setDiagnosticsLoading(true);
                  const results = await diagnoseAuthIssues();
                  setDiagnosticsResults(results);
                } catch (err) {
                  console.error('[Debug] Error running diagnostics:', err);
                  Alert.alert('Diagnostics Error', String(err));
                } finally {
                  setDiagnosticsLoading(false);
                }
              }} 
              disabled={diagnosticsLoading}
            />

            {diagnosticsLoading && (
              <View style={{ marginTop: 15, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={{ marginTop: 5, color: '#666' }}>Running diagnostics...</Text>
              </View>
            )}

            {diagnosticsResults && (
              <View style={{ marginTop: 15 }}>
                <Text style={styles.sectionSubtitle}>Diagnostic Results</Text>
                
                <View style={[styles.envItem, { backgroundColor: diagnosticsResults.summary?.success ? '#d5f5e3' : '#f5d5d5' }]}>
                  <Text style={styles.envKey}>Status</Text>
                  <Text style={styles.envValue}>
                    {diagnosticsResults.summary?.success ? 'PASS' : 'ISSUES FOUND'}
                  </Text>
                </View>
                
                <View style={styles.envItem}>
                  <Text style={styles.envKey}>Tests Passed</Text>
                  <Text style={styles.envValue}>
                    {diagnosticsResults.summary?.tests_passed || 0} / {diagnosticsResults.summary?.tests_total || 0}
                  </Text>
                </View>
                
                {diagnosticsResults.issues && diagnosticsResults.issues.length > 0 && (
                  <View style={styles.diagnoseSection}>
                    <Text style={styles.diagnoseSectionTitle}>Issues Found:</Text>
                    {diagnosticsResults.issues.map((issue, index) => (
                      <Text key={index} style={styles.diagnoseIssue}>• {issue}</Text>
                    ))}
                  </View>
                )}
                
                {diagnosticsResults.recommendations && diagnosticsResults.recommendations.length > 0 && (
                  <View style={styles.diagnoseSection}>
                    <Text style={styles.diagnoseSectionTitle}>Recommendations:</Text>
                    {diagnosticsResults.recommendations.map((rec, index) => (
                      <Text key={index} style={styles.diagnoseRecommendation}>• {rec}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email Authentication Testing</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email:</Text>
                <TextInput
                  style={styles.input}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="Enter email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password:</Text>
                <TextInput
                  style={styles.input}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter password"
                  secureTextEntry
                />
              </View>
              
              <View style={styles.buttonContainer}>
                <Button
                  title={authLoading ? "Signing in..." : "Sign In"}
                  disabled={authLoading || !emailInput || !passwordInput}
                  onPress={async () => {
                    setAuthLoading(true);
                    try {
                      const result = await signIn(emailInput, passwordInput);
                      if (result.success) {
                        Alert.alert('Success', 'Signed in successfully');
                        setEmailInput('');
                        setPasswordInput('');
                      } else {
                        Alert.alert('Error', result.error?.message || 'Sign in failed');
                      }
                    } catch (err) {
                      Alert.alert('Error', String(err));
                    } finally {
                      setAuthLoading(false);
                    }
                  }}
                />
              </View>
              
              <View style={{ marginTop: 10 }}>
                <Button
                  title="Sign Out"
                  onPress={async () => {
                    try {
                      await signOut();
                      Alert.alert('Success', 'Signed out successfully');
                    } catch (err) {
                      Alert.alert('Error', String(err));
                    }
                  }}
                />
              </View>
              
              <View style={{ marginTop: 10 }}>
                <Button
                  title="Refresh Token"
                  onPress={async () => {
                    try {
                      const success = await refreshToken();
                      if (success) {
                        Alert.alert('Success', 'Token refreshed successfully');
                      } else {
                        Alert.alert('Error', 'Failed to refresh token');
                      }
                    } catch (err) {
                      Alert.alert('Error', String(err));
                    }
                  }}
                />
              </View>
            </View>

            <Button
              title="Test Session Manually"
              onPress={testSessionManually}
              color="#6366F1"
            />
          </ScrollView>
        );
      case DebugTab.ENV:
        return (
          <ScrollView style={styles.envContainer}>
            <Text style={styles.envTitle}>Environment Variables</Text>
            {Object.keys(envVars).length === 0 ? (
              <Text style={styles.envEmpty}>No environment variables found</Text>
            ) : (
              Object.entries(envVars).map(([key, value]) => (
                <View key={key} style={styles.envItem}>
                  <Text style={styles.envKey}>{key}</Text>
                  <Text style={styles.envValue}>{value || '(empty)'}</Text>
                </View>
              ))
            )}
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device Information</Text>
              <View style={styles.envItem}>
                <Text style={styles.envKey}>Platform</Text>
                <Text style={styles.envValue}>{require('expo-constants').platform?.os || 'Unknown'}</Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envKey}>App Version</Text>
                <Text style={styles.envValue}>{require('expo-constants').expoConfig?.version || 'Unknown'}</Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envKey}>Development Mode</Text>
                <Text style={styles.envValue}>{__DEV__ ? 'Yes' : 'No'}</Text>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <Button 
                title="Force Test Error" 
                onPress={() => {
                  try {
                    throw new Error('Manually triggered test error');
                  } catch (error) {
                    console.error('[Debug] Manually triggered error:', error);
                  }
                }} 
              />
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  // Helper to render the current test case component
  const renderTestComponent = () => {
    if (selectedTest === null || showComponent === 'none') {
      return <Text style={styles.notice}>Select a test case and component to display</Text>;
    }

    const testCase = TEST_CASES[selectedTest];
    
    try {
      if (showComponent === 'standard') {
        return (
          <View style={styles.componentContainer}>
            <Text style={styles.componentTitle}>StandardErrorView with {testCase.name}</Text>
            <StandardErrorView error={testCase.value} />
          </View>
        );
      } else {
        return (
          <View style={styles.componentContainer}>
            <Text style={styles.componentTitle}>SafeErrorView with {testCase.name}</Text>
            <SafeErrorView error={testCase.value} />
          </View>
        );
      }
    } catch (e) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Component Crashed</Text>
          <Text style={styles.errorMessage}>
            {e instanceof Error ? e.message : String(e)}
          </Text>
          {e instanceof Error && e.stack && (
            <ScrollView style={styles.stackContainer}>
              <Text style={styles.stackText}>{e.stack}</Text>
            </ScrollView>
          )}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Error Handling Debugger</Text>
      
      <View style={styles.testButtonsContainer}>
        <Button title="Test getErrorMessage()" onPress={testGetErrorMessage} />
        <Button title="Test getErrorStack()" onPress={testGetErrorStack} />
      </View>

      <View style={styles.selectContainer}>
        <Text style={styles.subtitle}>Select Test Case:</Text>
        <ScrollView horizontal style={styles.testCasesScroll}>
          {TEST_CASES.map((test, index) => (
            <Button 
              key={index}
              title={test.name}
              onPress={() => setSelectedTest(index)}
              color={selectedTest === index ? '#3498db' : undefined}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.selectContainer}>
        <Text style={styles.subtitle}>Select Component:</Text>
        <View style={styles.componentButtons}>
          <Button 
            title="None" 
            onPress={() => setShowComponent('none')}
            color={showComponent === 'none' ? '#3498db' : undefined}
          />
          <Button 
            title="StandardErrorView" 
            onPress={() => setShowComponent('standard')}
            color={showComponent === 'standard' ? '#3498db' : undefined}
          />
          <Button 
            title="SafeErrorView" 
            onPress={() => setShowComponent('safe')}
            color={showComponent === 'safe' ? '#3498db' : undefined}
          />
        </View>
      </View>

      <View style={styles.resultContainer}>
        {testResults.length > 0 ? (
          <ScrollView style={styles.resultsList}>
            {testResults.map((result, index) => (
              <View key={index} style={[styles.resultItem, {
                backgroundColor: result.success ? '#d5f5e3' : '#f5d5d5'
              }]}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultText}>{result.result}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          renderTestComponent()
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  testButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  selectContainer: {
    marginBottom: 16,
  },
  testCasesScroll: {
    maxHeight: 50,
  },
  componentButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resultContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
    padding: 8,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  resultName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  notice: {
    textAlign: 'center',
    marginTop: 20,
    color: '#777',
  },
  componentContainer: {
    flex: 1,
  },
  componentTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 8,
  },
  stackContainer: {
    maxHeight: 200,
    marginTop: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
  },
  stackText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  envContainer: {
    flex: 1,
    padding: 10,
  },
  envTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  envItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
  envKey: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  envValue: {
    fontSize: 14,
    color: '#7f8c8d',
    fontFamily: 'monospace',
  },
  envEmpty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#7f8c8d',
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  diagnoseSection: {
    marginTop: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
  },
  diagnoseSectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  diagnoseIssue: {
    color: '#EF4444',
    marginBottom: 5,
  },
  diagnoseRecommendation: {
    color: '#3B82F6',
    marginBottom: 5,
  },
  inputContainer: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginTop: 10,
  },
}); 