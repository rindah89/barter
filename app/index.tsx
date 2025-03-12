import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { fixErrorHandling } from '../lib/ErrorFix';
import { applyExpoRouterFix } from '../lib/ExpoRouterFix';

// Apply error handling fixes immediately
if (typeof global !== 'undefined') {
  // Apply our error handling fixes
  fixErrorHandling();
  
  // Apply Expo Router specific fixes
  applyExpoRouterFix();
  
  // Monkey patch Error.prototype.toString to ensure it never fails
  const originalToString = Error.prototype.toString;
  Error.prototype.toString = function() {
    try {
      return originalToString.call(this);
    } catch (e) {
      return 'Error: [Error conversion failed]';
    }
  };
  
  // Ensure all errors have a message property
  const originalErrorConstructor = global.Error;
  global.Error = function(...args) {
    const error = new originalErrorConstructor(...args);
    if (!error.message) {
      try {
        error.message = args[0] || 'Unknown error';
      } catch (e) {
        // Cannot set message, ignore
      }
    }
    return error;
  };
  global.Error.prototype = originalErrorConstructor.prototype;
  
  console.log('[App] Applied error handling fixes');
}

export default function Index() {
  useEffect(() => {
    console.log('[Index] Rendering index page');
  }, []);
  
  // Redirect to the main page or splash screen
  return <Redirect href="/splash" />;
}