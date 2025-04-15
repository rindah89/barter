/**
 * ExpoRouterFix.tsx
 * This file contains fixes for Expo Router error handling
 * Enhanced based on insights from https://github.com/expo/router/issues/349
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ErrorBoundary } from 'expo-router';
import { ErrorBoundaryFallback } from './ErrorUtils';

// This function should be called before rendering the app
export function applyExpoRouterFix() {
  try {
    // Try to patch the Expo Router error handling
    const expoRouter = require('expo-router');
    
    // Save the original ErrorBoundary component
    const originalErrorBoundary = expoRouter.ErrorBoundary;
    
    // Replace it with our patched version
    expoRouter.ErrorBoundary = (props: any) => {
      // Create a safe fallback that handles undefined errors
      const safeFallback = (fallbackProps: any) => {
        // Ensure we have a valid error object
        const error = fallbackProps.error || new Error('Unknown Expo Router error');
        
        // If the original fallback is provided, use it with our safe error
        if (props.fallback) {
          return props.fallback({ ...fallbackProps, error });
        }
        
        // Otherwise use our default fallback
        return <ErrorBoundaryFallback error={error} />;
      };
      
      // Call the original ErrorBoundary with our safe fallback
      return originalErrorBoundary({
        ...props,
        fallback: safeFallback
      });
    };
    
    // Patch the router's internal error handling
    try {
      // Find and patch the internal router components that might use error.message
      const routerInternals = expoRouter.internal || {};
      
      // Patch the error formatter if it exists
      if (routerInternals.formatError) {
        const originalFormatError = routerInternals.formatError;
        routerInternals.formatError = (error: any) => {
          if (!error) {
            error = new Error('Unknown router error');
          } else if (typeof error === 'object' && !error.message) {
            try {
              error.message = 'Unknown error message';
            } catch (e) {
              error = new Error(String(error) || 'Unknown router error');
            }
          }
          return originalFormatError(error);
        };
      }
      
      // Patch any other internal methods that might access error.message
      const patchErrorHandlers = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Look for methods that might handle errors
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'function' && 
              (key.includes('error') || key.includes('Error') || key.includes('exception'))) {
            const original = obj[key];
            obj[key] = function(...args: any[]) {
              // Ensure any error arguments have a message property
              args = args.map(arg => {
                if (arg instanceof Error && !arg.message) {
                  try {
                    arg.message = 'Unknown error message';
                  } catch (e) {
                    return new Error(String(arg) || 'Unknown error');
                  }
                }
                return arg;
              });
              return original.apply(this, args);
            };
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively patch nested objects
            patchErrorHandlers(obj[key]);
          }
        });
      };
      
      // Patch internal router objects
      patchErrorHandlers(expoRouter);
      patchErrorHandlers(expoRouter.internal);
      
      // Specifically patch the router hooks that were mentioned in the GitHub issue
      patchRouterHooks(expoRouter);
    } catch (err) {
      console.warn('[ExpoRouterFix] Failed to patch internal router methods:', err);
    }
    
    console.log('[ExpoRouterFix] Successfully patched Expo Router error handling');
    return true;
  } catch (error) {
    console.error('[ExpoRouterFix] Failed to patch Expo Router error handling:', error);
    return false;
  }
}

// Patch specific router hooks that are known to cause issues
function patchRouterHooks(expoRouter: any) {
  try {
    // Patch useLocation hook - mentioned in the GitHub issue
    if (expoRouter.useLocation) {
      const originalUseLocation = expoRouter.useLocation;
      expoRouter.useLocation = function() {
        try {
          const location = originalUseLocation.apply(this, arguments);
          
          // Ensure location has required properties
          if (!location) {
            console.warn('[ExpoRouterFix] useLocation returned undefined, providing fallback');
            return { pathname: '/', params: {}, state: {} };
          }
          
          // Ensure type property exists (mentioned in issue #349)
          if (location && !location.type) {
            location.type = 'unknown';
          }
          
          return location;
        } catch (e) {
          console.warn('[ExpoRouterFix] Error in useLocation, providing fallback:', e);
          return { pathname: '/', params: {}, state: {} };
        }
      };
    }
    
    // Patch useSegments hook - mentioned by Jukizuka in the issue
    if (expoRouter.useSegments) {
      const originalUseSegments = expoRouter.useSegments;
      expoRouter.useSegments = function() {
        try {
          const segments = originalUseSegments.apply(this, arguments);
          
          // Ensure segments is an array
          if (!segments) {
            console.warn('[ExpoRouterFix] useSegments returned undefined, providing fallback');
            return [];
          }
          
          return segments;
        } catch (e) {
          console.warn('[ExpoRouterFix] Error in useSegments, providing fallback:', e);
          return [];
        }
      };
    }
    
    // Patch useRouteInfo hook - mentioned by trtin in the issue
    if (expoRouter.useRouteInfo) {
      const originalUseRouteInfo = expoRouter.useRouteInfo;
      expoRouter.useRouteInfo = function() {
        try {
          const routeInfo = originalUseRouteInfo.apply(this, arguments);
          
          // Ensure routeInfo has required properties
          if (!routeInfo) {
            console.warn('[ExpoRouterFix] useRouteInfo returned undefined, providing fallback');
            return { name: 'unknown', params: {} };
          }
          
          return routeInfo;
        } catch (e) {
          console.warn('[ExpoRouterFix] Error in useRouteInfo, providing fallback:', e);
          return { name: 'unknown', params: {} };
        }
      };
    }
    
    // Patch useRootNavigationState hook - mentioned in various comments
    if (expoRouter.useRootNavigationState) {
      const originalUseRootNavigationState = expoRouter.useRootNavigationState;
      expoRouter.useRootNavigationState = function() {
        try {
          const state = originalUseRootNavigationState.apply(this, arguments);
          
          // Return the state even if undefined - this is expected during initialization
          return state;
        } catch (e) {
          console.warn('[ExpoRouterFix] Error in useRootNavigationState:', e);
          return undefined;
        }
      };
    }
    
    console.log('[ExpoRouterFix] Successfully patched router hooks');
  } catch (e) {
    console.warn('[ExpoRouterFix] Failed to patch router hooks:', e);
  }
}

/**
 * A special version of ErrorBoundary that wraps Expo Router's ErrorBoundary
 * and adds extra safeguards to prevent propagation of errors from internal error handling
 */
export function SafeErrorBoundary({ 
  children, 
  onError 
}: { 
  children: React.ReactNode, 
  onError?: (error: Error) => void 
}) {
  return (
    <SuperSafeErrorBoundary onError={onError}>
      {children}
    </SuperSafeErrorBoundary>
  );
}

class SuperSafeErrorBoundary extends React.Component<
  {
    children: React.ReactNode; 
    onError?: (error: Error) => void;
  }, 
  {
    hasError: boolean; 
    error: Error | null;
  }
> {
  constructor(props: {children: React.ReactNode; onError?: (error: Error) => void;}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SuperSafeErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Call onError prop if provided
    if (this.props.onError) {
      try {
        this.props.onError(error);
      } catch (e) {
        console.error('Error in onError callback:', e);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong in the error boundary</Text>
          <Text style={styles.message}>
            {this.state.error ? this.state.error.message : 'Unknown error'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Debug version of StandardErrorView that helps trace the issue
 * This component is meant to be dynamically injected into Expo Router
 */
export function DebugStandardErrorView(props: any) {
  const [callStack, setCallStack] = useState<string>('');
  const [errorProps, setErrorProps] = useState<any>(null);
  
  useEffect(() => {
    try {
      // Create a new error to capture the current stack trace
      const stackError = new Error('Debug stack trace');
      setCallStack(stackError.stack || 'No stack available');
      
      // Log details about the props
      console.log('[DebugStandardErrorView] Received props:', JSON.stringify(props, null, 2));
      setErrorProps(props);
      
      // Analyze the error prop specifically
      if (props && 'error' in props) {
        console.log('[DebugStandardErrorView] Error prop is present');
        
        if (props.error === undefined) {
          console.log('[DebugStandardErrorView] Error prop is undefined');
        } else if (props.error === null) {
          console.log('[DebugStandardErrorView] Error prop is null');
        } else {
          console.log('[DebugStandardErrorView] Error prop type:', typeof props.error);
          console.log('[DebugStandardErrorView] Error prop constructor:', props.error.constructor?.name);
          console.log('[DebugStandardErrorView] Error prop keys:', Object.keys(props.error));
          
          // Specifically check for message property
          if ('message' in props.error) {
            console.log('[DebugStandardErrorView] Message property exists:', props.error.message);
          } else {
            console.log('[DebugStandardErrorView] Message property does not exist on error object');
          }
        }
      } else {
        console.log('[DebugStandardErrorView] No error prop found in props');
      }
    } catch (e) {
      console.error('[DebugStandardErrorView] Error in debugging code:', e);
    }
  }, [props]);
  
  // Render a simple view with debug info instead of trying to use the actual error
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug Error View</Text>
      
      <Text style={styles.subtitle}>Component Call Stack:</Text>
      <Text style={styles.code}>{callStack}</Text>
      
      <Text style={styles.subtitle}>Props Received:</Text>
      <Text style={styles.code}>
        {errorProps ? JSON.stringify(errorProps, (key, value) => {
          if (value === undefined) return 'undefined';
          if (value === null) return 'null';
          if (typeof value === 'function') return '[Function]';
          if (typeof value === 'object' && value !== null) {
            if (key === '') return value; // Don't modify the root object
            // For non-root objects, convert to a simplified representation
            return Object.keys(value).reduce((acc: any, k) => {
              acc[k] = typeof value[k];
              return acc;
            }, {});
          }
          return value;
        }, 2) : 'No props data'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    marginBottom: 16,
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 4,
    fontSize: 12,
  },
});