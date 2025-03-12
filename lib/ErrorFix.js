/**
 * ErrorFix.js
 * This file contains fixes for error handling in the app
 */

// This function should be called at app startup
export function fixErrorHandling() {
  try {
    // Create a safe error handler that ensures errors always have a message property
    const safeErrorHandler = (originalHandler) => {
      return function(error) {
        // Ensure we have a valid error object
        if (!error) {
          error = new Error('Unknown error (undefined error object)');
        } else if (typeof error === 'string') {
          error = new Error(error);
        } else if (typeof error === 'object' && !error.message) {
          // Try to add a message property if it doesn't exist
          try {
            error.message = 'Unknown error (no message property)';
          } catch (e) {
            // If we can't add a message property, create a new error
            error = new Error('Unknown error (could not add message property)');
          }
        }
        
        // Call the original handler with our safe error
        return originalHandler(error);
      };
    };
    
    // Apply the fix to global error handler if available
    if (global.ErrorUtils) {
      const originalHandler = global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler(safeErrorHandler(originalHandler));
      console.log('[ErrorFix] Successfully patched global error handler');
    }
    
    // Patch console.error to ensure errors always have a message
    const originalConsoleError = console.error;
    console.error = function(...args) {
      // If the first argument is an error, ensure it has a message
      if (args.length > 0 && args[0] instanceof Error && !args[0].message) {
        try {
          args[0].message = 'Unknown error (no message property)';
        } catch (e) {
          // If we can't add a message property, create a new error
          args[0] = new Error('Unknown error (could not add message property)');
        }
      }
      
      // Call the original console.error
      return originalConsoleError.apply(console, args);
    };
    
    // Patch Object.prototype.hasOwnProperty to be safer
    const originalHasOwnProperty = Object.prototype.hasOwnProperty;
    Object.prototype.hasOwnProperty = function(prop) {
      try {
        return originalHasOwnProperty.call(this, prop);
      } catch (e) {
        return false;
      }
    };
    
    // Patch Object.prototype.toString to be safer
    const originalToString = Object.prototype.toString;
    Object.prototype.toString = function() {
      try {
        return originalToString.call(this);
      } catch (e) {
        return '[object Unknown]';
      }
    };
    
    // Patch JSON.stringify to handle circular references and errors
    const originalStringify = JSON.stringify;
    JSON.stringify = function(obj, replacer, space) {
      try {
        // Create a new replacer function that handles errors
        const safeReplacer = (key, value) => {
          // Handle Error objects specially
          if (value instanceof Error) {
            return {
              name: value.name || 'Error',
              message: value.message || 'Unknown error',
              stack: value.stack || 'No stack trace'
            };
          }
          
          // Use the original replacer if provided
          if (typeof replacer === 'function') {
            return replacer(key, value);
          }
          
          return value;
        };
        
        return originalStringify(obj, safeReplacer, space);
      } catch (e) {
        // If stringify fails, return a safe string
        return '"[Stringify failed]"';
      }
    };
    
    // Specifically target Expo Router error
    try {
      // Try to load expo-router
      const expoRouter = require('expo-router');
      
      // If it's loaded, patch its error handling
      if (expoRouter && expoRouter.ErrorBoundary) {
        console.log('[ErrorFix] Found Expo Router, applying specific fixes');
        
        // Ensure the error boundary always has a valid error
        const originalErrorBoundary = expoRouter.ErrorBoundary;
        expoRouter.ErrorBoundary = function(props) {
          // Ensure fallback always receives a valid error
          const safeFallback = (fallbackProps) => {
            // Create a safe error object if error is undefined
            const safeError = fallbackProps.error || new Error('Unknown Expo Router error');
            
            // Call the original fallback with our safe error
            if (props.fallback) {
              return props.fallback({ ...fallbackProps, error: safeError });
            }
            
            // If no fallback is provided, return a default error view
            return React.createElement('div', null, 
              React.createElement('h1', null, 'Error'),
              React.createElement('p', null, safeError.message || 'Unknown error')
            );
          };
          
          // Call the original error boundary with our safe fallback
          return originalErrorBoundary({
            ...props,
            fallback: safeFallback
          });
        };
      }
    } catch (e) {
      console.warn('[ErrorFix] Failed to patch Expo Router:', e);
    }
    
    console.log('[ErrorFix] Successfully patched error handling');
    return true;
  } catch (error) {
    // If anything goes wrong, log it but don't crash
    console.error('[ErrorFix] Failed to patch error handling:', error);
    return false;
  }
}