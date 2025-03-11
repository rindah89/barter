/**
 * ErrorUtils.ts
 * Utility functions and components for error handling throughout the app
 */

import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

// Safe error message extraction that handles undefined errors
export function getErrorMessage(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  
  if (typeof error === 'object') {
    // Try to extract message from error object
    if (error.message) {
      return error.message;
    }
    
    // Try to stringify the error object
    try {
      return JSON.stringify(error);
    } catch (e) {
      // If stringify fails, return a generic message
      return 'Error object could not be serialized';
    }
  }
  
  return 'An unknown error occurred';
}

// A component to display errors safely
export function SafeErrorView({ 
  error, 
  title = 'Something went wrong',
  hint = 'Please try again or restart the app'
}: { 
  error: any, 
  title?: string,
  hint?: string
}) {
  const errorMessage = getErrorMessage(error);
  
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{errorMessage}</Text>
      <Text style={styles.errorHint}>{hint}</Text>
    </View>
  );
}

// This component specifically overrides Expo Router's internal StandardErrorView
export function StandardErrorView({ error }: { error?: any }) {
  return (
    <SafeErrorView 
      error={error} 
      title="Navigation Error" 
      hint="Please try again or restart the app" 
    />
  );
}

// Styles for error views
const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#e74c3c',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  errorHint: {
    fontSize: 14,
    color: '#7f8c8d',
  },
});

// Global error logger
export function logError(error: any, context?: string): void {
  const prefix = context ? `[${context}]` : '[App Error]';
  const message = getErrorMessage(error);
  
  console.error(`${prefix} ${message}`);
  
  // Here you could add additional error reporting logic
  // such as sending errors to a monitoring service
}

// Error boundary component as a function component
export function ErrorBoundaryFallback({ error }: { error: any }) {
  return (
    <SafeErrorView 
      error={error} 
      title="Something went wrong" 
      hint="Try restarting the app" 
    />
  );
} 