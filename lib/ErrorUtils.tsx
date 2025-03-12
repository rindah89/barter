/**
 * ErrorUtils.tsx
 * Utility functions and components for error handling throughout the app
 */

import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';
import React, { useState, useEffect } from 'react';

// Store for recent errors
const errorStore: {
  errors: Array<{
    timestamp: Date;
    message: string;
    context?: string;
    stack?: string;
  }>;
} = {
  errors: [],
};

// Maximum number of errors to store
const MAX_STORED_ERRORS = 20;

// Safe error message extraction that handles undefined errors
export function getErrorMessage(error: any): string {
  if (error === undefined || error === null) {
    return 'An unknown error occurred (error object is undefined or null)';
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
  
  return `An unknown error occurred (type: ${typeof error})`;
}

// Get stack trace from error
export function getErrorStack(error: any): string | undefined {
  if (error === undefined || error === null) {
    return 'No stack trace available (error object is undefined or null)';
  }
  
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  
  if (typeof error === 'object' && error.stack) {
    return error.stack;
  }
  
  // Create a new error to capture the current stack trace
  if (typeof error === 'string') {
    const newError = new Error(error);
    return newError.stack;
  }
  
  return 'No stack trace available';
}

// Global error logger with enhanced visibility
export function logError(error: any, context?: string): void {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);
  const timestamp = new Date();
  
  // Store error for later viewing
  errorStore.errors.unshift({
    timestamp,
    message,
    context,
    stack,
  });
  
  // Trim error store if it gets too large
  if (errorStore.errors.length > MAX_STORED_ERRORS) {
    errorStore.errors = errorStore.errors.slice(0, MAX_STORED_ERRORS);
  }
  
  // Format timestamp
  const timeString = timestamp.toISOString();
  
  // Create a highly visible error message
  const prefix = context ? `[${context}]` : '[App Error]';
  
  // Log with high visibility
  console.error('\n\n');
  console.error('='.repeat(80));
  console.error(`${timeString} - ${prefix} ERROR`);
  console.error('-'.repeat(80));
  console.error(`Message: ${message}`);
  
  if (stack) {
    console.error('-'.repeat(80));
    console.error('Stack Trace:');
    console.error(stack);
  }
  
  console.error('='.repeat(80));
  console.error('\n\n');
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
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage = getErrorMessage(error);
  const errorStack = getErrorStack(error);
  
  // Log the error immediately for visibility
  useEffect(() => {
    logError(error, 'SafeErrorView');
  }, [error]);
  
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{errorMessage}</Text>
      <Text style={styles.errorHint}>{hint}</Text>
      
      <Button 
        title={showDetails ? "Hide Error Details" : "Show Error Details"} 
        onPress={() => setShowDetails(!showDetails)} 
      />
      
      {showDetails && (
        <ScrollView style={styles.errorDetailsContainer}>
          <View style={styles.errorDetailsBox}>
            <Text style={styles.errorDetailsTitle}>Error Details:</Text>
            <Text style={styles.errorDetailsText}>
              Type: {error ? error.constructor?.name || typeof error : 'Unknown'}
            </Text>
            <Text style={styles.errorDetailsText}>
              Message: {errorMessage}
            </Text>
            {errorStack && (
              <>
                <Text style={styles.errorDetailsSubtitle}>Stack Trace:</Text>
                <Text style={styles.errorDetailsStack}>{errorStack}</Text>
              </>
            )}
            {error && typeof error === 'object' && (
              <>
                <Text style={styles.errorDetailsSubtitle}>Properties:</Text>
                {Object.entries(error)
                  .filter(([key]) => key !== 'stack' && key !== 'message')
                  .map(([key, value]) => (
                    <Text key={key} style={styles.errorDetailsText}>
                      {key}: {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2) 
                        : String(value)}
                    </Text>
                  ))
                }
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// This component specifically overrides Expo Router's internal StandardErrorView
export function StandardErrorView({ error }: { error?: any }) {
  // Log the error immediately for visibility
  useEffect(() => {
    if (error) {
      console.log('[StandardErrorView] Received error:', error);
      logError(error, 'StandardErrorView');
    } else {
      console.warn('[StandardErrorView] Received undefined error');
      logError(new Error('Undefined error in StandardErrorView'), 'StandardErrorView');
    }
  }, [error]);
  
  return (
    <SafeErrorView 
      error={error || new Error('Unknown navigation error')} 
      title="Navigation Error" 
      hint="Please try again or restart the app" 
    />
  );
}

// Debug screen to show recent errors
export function ErrorDebugScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Error Debug Screen</Text>
      <Button title="Refresh" onPress={refresh} />
      
      <ScrollView style={styles.debugScrollView}>
        {errorStore.errors.length === 0 ? (
          <Text style={styles.debugNoErrors}>No errors recorded</Text>
        ) : (
          errorStore.errors.map((error, index) => (
            <View key={`${index}-${refreshKey}`} style={styles.debugErrorItem}>
              <Text style={styles.debugErrorTime}>
                {error.timestamp.toLocaleString()}
              </Text>
              <Text style={styles.debugErrorContext}>
                {error.context || 'Unknown context'}
              </Text>
              <Text style={styles.debugErrorMessage}>
                {error.message}
              </Text>
              {error.stack && (
                <Text style={styles.debugErrorStack}>
                  {error.stack}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
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
    marginBottom: 20,
  },
  errorDetailsContainer: {
    maxHeight: 300,
    width: '100%',
    marginTop: 20,
  },
  errorDetailsBox: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e74c3c',
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#e74c3c',
  },
  errorDetailsText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  errorDetailsSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: '#e74c3c',
  },
  errorDetailsStack: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  debugContainer: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  debugTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  debugScrollView: {
    flex: 1,
    marginTop: 10,
  },
  debugErrorItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  debugErrorTime: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  debugErrorContext: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  debugErrorMessage: {
    fontSize: 14,
    color: '#e74c3c',
    marginBottom: 5,
  },
  debugErrorStack: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  debugNoErrors: {
    textAlign: 'center',
    marginTop: 20,
    color: '#7f8c8d',
  },
});

// Error boundary component as a function component
export function ErrorBoundaryFallback({ error }: { error: any }) {
  // Log the error immediately for visibility
  useEffect(() => {
    if (error) {
      console.log('[ErrorBoundaryFallback] Received error:', error);
      logError(error, 'ErrorBoundaryFallback');
    } else {
      console.warn('[ErrorBoundaryFallback] Received undefined error');
      logError(new Error('Undefined error in ErrorBoundaryFallback'), 'ErrorBoundaryFallback');
    }
  }, [error]);
  
  return (
    <SafeErrorView 
      error={error || new Error('Unknown error in error boundary')} 
      title="Something went wrong" 
      hint="Try restarting the app" 
    />
  );
} 