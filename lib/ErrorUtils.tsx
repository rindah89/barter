/**
 * ErrorUtils.tsx
 * Utility functions and components for error handling throughout the app
 */

import { View, Text, StyleSheet, ScrollView, Button, TouchableOpacity, Platform, Alert } from 'react-native';
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
  // Handle undefined or null error objects
  if (error === undefined || error === null) {
    return 'An unknown error occurred (error object is undefined or null)';
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    // Safely access the message property
    return (error.message || error.toString()) || 'Error without message';
  }
  
  // Handle generic object errors
  if (typeof error === 'object') {
    try {
      // Safely access the message property
      if (error.message !== undefined && error.message !== null) {
        return String(error.message);
      }
      
      // Try to stringify the error object
      const stringified = JSON.stringify(error);
      return stringified !== '{}' ? stringified : 'Error object has no properties';
    } catch (e) {
      // If stringify fails, return a generic message
      return 'Error object could not be serialized';
    }
  }
  
  // Fallback for other types
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

// Update the copyToClipboard function to use a simple alert instead of clipboard
const copyToClipboard = async (text: string) => {
  try {
    // Display the error details in an alert that can be manually copied
    Alert.alert(
      "Error Details",
      "Error details are shown below. Press and hold to select and copy.",
      [
        { text: "OK", style: "cancel" }
      ],
      { cancelable: true }
    );
    
    console.log('[ErrorUtils] Error details shown in alert for copying');
    return true;
  } catch (e) {
    console.error('[ErrorUtils] Failed to show error details:', e);
    return false;
  }
};

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
  // Ensure we have a valid error object using a try-catch block
  let safeError;
  try {
    // If error is undefined or null, create a new Error object
    if (error === undefined || error === null) {
      safeError = new Error('Unknown error');
    } else if (typeof error === 'string') {
      // If error is a string, create a new Error object with the string as message
      safeError = new Error(error);
    } else {
      // Otherwise, use the error as is
      safeError = error;
    }
  } catch (e) {
    // If any error occurs during this process, create a fallback error
    console.error('[SafeErrorView] Error creating safe error object:', e);
    safeError = new Error('Error handling failed');
  }
  
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Safely extract error details with defensive error handling
  const errorMessage = React.useMemo(() => {
    try {
      return getErrorMessage(safeError);
    } catch (e) {
      console.error('[SafeErrorView] Error getting error message:', e);
      return 'Error message could not be extracted';
    }
  }, [safeError]);
  
  const errorStack = React.useMemo(() => {
    try {
      return getErrorStack(safeError);
    } catch (e) {
      console.error('[SafeErrorView] Error getting error stack:', e);
      return 'Error stack could not be extracted';
    }
  }, [safeError]);
  
  // Log the error immediately for visibility
  useEffect(() => {
    try {
      logError(safeError, 'SafeErrorView');
    } catch (e) {
      console.error('[SafeErrorView] Error while logging error:', e);
    }
  }, [safeError]);

  // Reset copied state after 3 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  
  // Format error details for clipboard
  const getFormattedErrorDetails = () => {
    try {
      const timestamp = new Date().toISOString();
      const details = [
        `=== ERROR DETAILS (${timestamp}) ===`,
        `Type: ${safeError ? safeError.constructor?.name || typeof safeError : 'Unknown'}`,
        `Message: ${errorMessage}`,
      ];
      
      if (errorStack) {
        details.push('\n=== STACK TRACE ===');
        details.push(errorStack);
      }
      
      if (safeError && typeof safeError === 'object') {
        details.push('\n=== ADDITIONAL PROPERTIES ===');
        Object.entries(safeError)
          .filter(([key]) => key !== 'stack' && key !== 'message')
          .forEach(([key, value]) => {
            try {
              details.push(`${key}: ${typeof value === 'object' 
                ? JSON.stringify(value, null, 2) 
                : String(value)}`);
            } catch (e) {
              details.push(`${key}: [Error: Could not stringify property]`);
            }
          });
      }
      
      return details.join('\n');
    } catch (e) {
      console.error('[SafeErrorView] Error formatting error details:', e);
      return `Error occurred while formatting error details: ${e}`;
    }
  };
  
  // Handle showing error details for copy
  const handleShowErrorDetails = () => {
    if (!showDetails) {
      // When showing details for the first time, log them to the console as well
      const details = getFormattedErrorDetails();
      console.log('\n\n' + details + '\n\n');
    }
    setShowDetails(!showDetails);
  };
  
  // Show error details in an alert for manual copying
  const handleCopyDetails = async () => {
    const text = getFormattedErrorDetails();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
    }

    // Also log to console for dev debugging
    console.log('\n\n' + text + '\n\n');
  };
  
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{errorMessage}</Text>
      <Text style={styles.errorHint}>{hint}</Text>
      
      <View style={styles.buttonRow}>
        <Button 
          title={showDetails ? "Hide Error Details" : "Show Error Details"} 
          onPress={handleShowErrorDetails} 
        />
        
        {showDetails && (
          <TouchableOpacity 
            style={[styles.copyButton, copied && styles.copyButtonSuccess]} 
            onPress={handleCopyDetails}
          >
            <Text style={styles.copyButtonText}>
              {copied ? "Shown!" : "Show in Alert"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {showDetails && (
        <ScrollView style={styles.errorDetailsContainer}>
          <View style={styles.errorDetailsBox}>
            <Text style={styles.errorDetailsTitle}>Error Details:</Text>
            <Text style={styles.errorDetailsText}>
              Type: {safeError ? safeError.constructor?.name || typeof safeError : 'Unknown'}
            </Text>
            <Text style={styles.errorDetailsText}>
              Message: {errorMessage}
            </Text>
            {errorStack && (
              <>
                <Text style={styles.errorDetailsSubtitle}>Stack Trace:</Text>
                <Text style={styles.errorDetailsStack} selectable={true}>{errorStack}</Text>
              </>
            )}
            {safeError && typeof safeError === 'object' && (
              <>
                <Text style={styles.errorDetailsSubtitle}>Properties:</Text>
                {Object.entries(safeError)
                  .filter(([key]) => key !== 'stack' && key !== 'message')
                  .map(([key, value]) => {
                    let displayValue;
                    try {
                      displayValue = typeof value === 'object' 
                        ? JSON.stringify(value, null, 2) 
                        : String(value);
                    } catch (e) {
                      displayValue = '[Error: Could not stringify property]';
                    }
                    return (
                      <Text key={key} style={styles.errorDetailsText} selectable={true}>
                        {key}: {displayValue}
                      </Text>
                    );
                  })
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
  // Create a safe error object if error is undefined or null
  // Use a try-catch block to handle any unexpected errors during object creation
  let safeError;
  try {
    // First ensure we have a valid error object
    if (error === undefined || error === null) {
      console.warn('[StandardErrorView] Received undefined or null error');
      safeError = new Error('Unknown navigation error');
    } else if (error instanceof Error) {
      console.log('[StandardErrorView] Received Error instance');
      
      // Ensure the error has a message property
      if (!error.message) {
        try {
          Object.defineProperty(error, 'message', {
            value: 'No error message provided',
            enumerable: true,
            writable: true,
            configurable: true
          });
        } catch (e) {
          // If we can't modify the original error, create a new one
          safeError = new Error('Error without message');
          safeError.stack = error.stack;
          console.log('[StandardErrorView] Created new error with message');
        }
      }
      
      if (!safeError) {
        safeError = error;
      }
    } else if (typeof error === 'string') {
      console.log('[StandardErrorView] Received string error');
      safeError = new Error(error);
    } else if (typeof error === 'object') {
      console.log('[StandardErrorView] Received object error');
      // Try to extract message from error object
      if (error.message !== undefined && error.message !== null) {
        safeError = new Error(String(error.message));
      } else {
        // Try to stringify the object for the message
        try {
          safeError = new Error(JSON.stringify(error));
        } catch (e) {
          safeError = new Error('Error object could not be serialized');
        }
      }
      
      // Copy stack if available
      if (error.stack) {
        safeError.stack = error.stack;
      }
    } else {
      console.log('[StandardErrorView] Received other type of error:', typeof error);
      safeError = new Error(`Unknown error of type: ${typeof error}`);
    }
  } catch (e) {
    console.error('[StandardErrorView] Error creating safe error object:', e);
    safeError = new Error('Error handling failed');
  }
  
  // Do a final verification that our error has a message
  if (!safeError.message) {
    try {
      safeError.message = 'No message provided';
    } catch (e) {
      // If we can't set message, create a completely new error
      safeError = new Error('Error without accessible message property');
    }
  }
  
  // Log the error immediately for visibility
  useEffect(() => {
    try {
      logError(safeError, 'StandardErrorView');
    } catch (e) {
      console.error('[StandardErrorView] Error while logging error:', e);
    }
  }, [safeError]);
  
  // Ensure we're rendering with a safe error object
  return (
    <SafeErrorView 
      error={safeError} 
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
    padding: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorDetailsContainer: {
    maxHeight: 400,
    width: '100%',
    marginTop: 10,
  },
  errorDetailsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  errorDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  errorDetailsSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
    color: '#2c3e50',
  },
  errorDetailsText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorDetailsStack: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  copyButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  copyButtonSuccess: {
    backgroundColor: '#2ecc71',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  debugContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f9fa',
  },
  debugTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  debugScrollView: {
    flex: 1,
    marginTop: 15,
  },
  debugErrorItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugNoErrors: {
    textAlign: 'center',
    marginTop: 20,
    color: '#7f8c8d',
  },
});

// Error boundary component as a function component
export function ErrorBoundaryFallback({ error }: { error?: any }) {
  // Create a safe error object if error is undefined
  const safeError = error || new Error('Unknown error in error boundary');
  
  // Log the error immediately for visibility
  useEffect(() => {
    try {
      if (error) {
        console.log('[ErrorBoundaryFallback] Received error:', error);
        logError(error, 'ErrorBoundaryFallback');
      } else {
        console.warn('[ErrorBoundaryFallback] Received undefined error');
        logError(safeError, 'ErrorBoundaryFallback');
      }
    } catch (e) {
      console.error('[ErrorBoundaryFallback] Error while logging error:', e);
    }
  }, [error, safeError]);
  
  return (
    <SafeErrorView 
      error={safeError} 
      title="Something went wrong" 
      hint="Try restarting the app or copying the error details to report the issue" 
    />
  );
} 