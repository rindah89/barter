import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ErrorDebugScreen } from '../lib/ErrorUtils';
import { LogViewer, captureConsoleLogs } from '../lib/LogCapture';
import { StatusBar } from 'expo-status-bar';

// Debug tabs
enum DebugTab {
  ERRORS = 'Errors',
  LOGS = 'Logs',
  ENV = 'Environment',
}

export default function DebugScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DebugTab>(DebugTab.ERRORS);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

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

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case DebugTab.ERRORS:
        return <ErrorDebugScreen />;
      case DebugTab.LOGS:
        return <LogViewer />;
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Debug Console',
        headerShown: true,
        headerLeft: () => (
          <Button
            title="Back"
            onPress={() => router.back()}
          />
        ),
      }} />
      
      <StatusBar style="auto" />
      
      <View style={styles.tabBar}>
        {Object.values(DebugTab).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText,
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.content}>
        {renderTabContent()}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Debug console - For development purposes only
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  footer: {
    padding: 10,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
  },
  footerText: {
    color: '#ecf0f1',
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
}); 