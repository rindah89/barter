/**
 * ExpoRouterFix.tsx
 * This file contains fixes for Expo Router error handling
 */

import React from 'react';
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

// Safe wrapper for Expo Router's ErrorBoundary
export function SafeErrorBoundary({ children, fallback }: { children: React.ReactNode, fallback?: (props: any) => React.ReactNode }) {
  try {
    const expoRouter = require('expo-router');
    const ErrorBoundary = expoRouter.ErrorBoundary;
    
    // Create a safe fallback that handles undefined errors
    const safeFallback = (props: any) => {
      // Ensure we have a valid error object
      const error = props.error || new Error('Unknown error in SafeErrorBoundary');
      
      // If a custom fallback is provided, use it with our safe error
      if (fallback) {
        return fallback({ ...props, error });
      }
      
      // Otherwise use our default fallback
      return <ErrorBoundaryFallback error={error} />;
    };
    
    return (
      <ErrorBoundary fallback={safeFallback}>
        {children}
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[SafeErrorBoundary] Failed to create safe error boundary:', error);
    return <>{children}</>;
  }
}