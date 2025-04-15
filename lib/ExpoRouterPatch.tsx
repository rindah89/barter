/**
 * ExpoRouterPatch.tsx
 * Monkey patches Expo Router to make it more resilient
 */

import React from 'react';
import { DebugStandardErrorView } from './ExpoRouterFix';

// Flag to prevent multiple applications of the patch
let patchApplied = false;

// This will patch the StandardErrorView in expo-router to use our debug version
export function patchExpoRouter() {
  if (patchApplied) {
    console.log('[ExpoRouterPatch] Patch already applied');
    return;
  }

  try {
    console.log('[ExpoRouterPatch] Attempting to patch Expo Router...');
    
    // Try to require expo-router
    const expoRouterModule = require('expo-router');
    
    if (!expoRouterModule) {
      console.warn('[ExpoRouterPatch] Failed to require expo-router');
      return;
    }
    
    // Check if StandardErrorView exists in the module
    const hasStandardErrorView = Object.keys(expoRouterModule).includes('StandardErrorView');
    console.log('[ExpoRouterPatch] StandardErrorView found in expo-router module:', hasStandardErrorView);
    
    if (hasStandardErrorView) {
      // Save original implementation
      const OriginalStandardErrorView = expoRouterModule.StandardErrorView;
      
      // Define a wrapped version
      const WrappedStandardErrorView = (props: any) => {
        console.log('[ExpoRouterPatch] Wrapped StandardErrorView called with props:', 
          props ? Object.keys(props) : 'no props');
        
        try {
          // First try our debug view to get information
          return <DebugStandardErrorView {...props} original={OriginalStandardErrorView} />;
        } catch (e) {
          console.error('[ExpoRouterPatch] Debug view failed:', e);
          
          // Fall back to original if debug view fails
          try {
            return <OriginalStandardErrorView {...props} />;
          } catch (e2) {
            console.error('[ExpoRouterPatch] Original view also failed:', e2);
            
            // Last resort fallback
            return (
              <div style={{padding: 20, backgroundColor: '#ffeeee'}}>
                <h3>Error View Failed</h3>
                <p>Both debug and original error views crashed</p>
              </div>
            );
          }
        }
      };
      
      // Replace the original with our wrapped version
      try {
        Object.defineProperty(expoRouterModule, 'StandardErrorView', {
          get: () => WrappedStandardErrorView
        });
        console.log('[ExpoRouterPatch] Successfully patched StandardErrorView');
        patchApplied = true;
      } catch (e) {
        console.error('[ExpoRouterPatch] Failed to redefine StandardErrorView:', e);
      }
    } else {
      // Try deeper exploration to find the StandardErrorView
      console.log('[ExpoRouterPatch] StandardErrorView not found at top level, searching deeper...');
      
      // Explore internal modules
      const internalModules = Object.keys(expoRouterModule)
        .filter(key => typeof expoRouterModule[key] === 'object' && expoRouterModule[key] !== null);
      
      console.log('[ExpoRouterPatch] Internal modules found:', internalModules);
      
      // Look for StandardErrorView in each internal module
      let found = false;
      internalModules.forEach(moduleName => {
        const module = expoRouterModule[moduleName];
        
        if (module && typeof module === 'object' && 'StandardErrorView' in module) {
          console.log(`[ExpoRouterPatch] Found StandardErrorView in ${moduleName}`);
          
          // Save original
          const OriginalStandardErrorView = module.StandardErrorView;
          
          // Replace with wrapped version
          try {
            Object.defineProperty(module, 'StandardErrorView', {
              get: () => (props: any) => {
                console.log(`[ExpoRouterPatch] ${moduleName}.StandardErrorView called`);
                return <DebugStandardErrorView {...props} original={OriginalStandardErrorView} />;
              }
            });
            console.log(`[ExpoRouterPatch] Successfully patched ${moduleName}.StandardErrorView`);
            found = true;
            patchApplied = true;
          } catch (e) {
            console.error(`[ExpoRouterPatch] Failed to patch ${moduleName}.StandardErrorView:`, e);
          }
        }
      });
      
      if (!found) {
        console.warn('[ExpoRouterPatch] Could not locate StandardErrorView for patching');
      }
    }
  } catch (e) {
    console.error('[ExpoRouterPatch] Error during patch attempt:', e);
  }
}

// Apply the patch immediately if in a browser environment
if (typeof window !== 'undefined') {
  // Wait for modules to be fully loaded
  setTimeout(patchExpoRouter, 100);
} 