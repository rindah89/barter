import { supabase } from './supabase';

/**
 * Diagnoses potential issues with authentication
 * This is useful for debugging authentication problems
 */
export async function diagnoseAuthIssues() {
  console.log('[diagnoseAuth] Starting authentication diagnosis');
  
  const result = {
    timestamp: new Date().toISOString(),
    tests: {} as Record<string, any>,
    issues: [] as string[],
    recommendations: [] as string[],
  };
  
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('[diagnoseAuth] Testing Supabase connection');
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      result.tests.supabaseConnection = {
        success: !error,
        error: error ? error.message : null
      };
      
      if (error) {
        result.issues.push('Cannot connect to Supabase API');
        result.recommendations.push('Check your network connection and Supabase API keys');
      }
    } catch (err: any) {
      result.tests.supabaseConnection = {
        success: false,
        error: err.message
      };
      
      result.issues.push('Exception when connecting to Supabase');
      result.recommendations.push('Verify Supabase configuration in .env file');
    }
    
    // Test 2: Check if we have an active session
    console.log('[diagnoseAuth] Checking active session');
    try {
      const { data, error } = await supabase.auth.getSession();
      result.tests.activeSession = {
        success: !error && !!data.session,
        error: error ? error.message : null,
        hasSession: !!data.session
      };
      
      if (!data.session) {
        result.issues.push('No active Supabase session found');
        result.recommendations.push('Try signing in again or check if session token is expired');
      }
      
      // If we have a session, add session info
      if (data.session) {
        result.tests.sessionInfo = {
          expires_at: new Date(data.session.expires_at * 1000).toISOString(),
          expires_in: Math.floor((data.session.expires_at * 1000 - Date.now()) / 1000),
          provider: data.session?.user?.app_metadata?.provider,
          user_id: data.session?.user?.id
        };
        
        // Check if session is about to expire
        if (data.session.expires_at * 1000 - Date.now() < 300000) { // less than 5 minutes
          result.issues.push('Session is about to expire');
          result.recommendations.push('Refreshing the token is recommended');
        }
      }
    } catch (err: any) {
      result.tests.activeSession = {
        success: false,
        error: err.message
      };
      
      result.issues.push('Exception when checking session');
      result.recommendations.push('There might be an issue with the Supabase auth client');
    }
    
    // Test 3: Check if the user exists
    console.log('[diagnoseAuth] Checking user data');
    try {
      const { data, error } = await supabase.auth.getUser();
      result.tests.userData = {
        success: !error && !!data.user,
        error: error ? error.message : null,
        hasUser: !!data.user
      };
      
      if (!data.user) {
        result.issues.push('No user data found');
        result.recommendations.push('User might be logged out or session token invalid');
      } else {
        // Check if email is confirmed
        if (!data.user.email_confirmed_at) {
          result.issues.push('Email is not confirmed');
          result.recommendations.push('User should confirm their email address');
        }
      }
    } catch (err: any) {
      result.tests.userData = {
        success: false,
        error: err.message
      };
      
      result.issues.push('Exception when fetching user data');
      result.recommendations.push('There might be an issue with the authentication state');
    }
    
    // Test 4: Check if profile exists for user
    console.log('[diagnoseAuth] Checking user profile');
    
    // Only proceed if we have a user
    if (result.tests.userData?.hasUser) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userData.user.id)
            .single();
            
          result.tests.profileData = {
            success: !error && !!profile,
            error: error ? error.message : null,
            hasProfile: !!profile
          };
          
          if (!profile) {
            result.issues.push('User does not have a profile in the database');
            result.recommendations.push('Create a profile for this user');
          }
        }
      } catch (err: any) {
        result.tests.profileData = {
          success: false,
          error: err.message
        };
        
        result.issues.push('Exception when checking profile data');
        result.recommendations.push('There might be an issue with the database or permissions');
      }
    } else {
      result.tests.profileData = {
        success: false,
        error: 'Cannot check profile without user data',
        skipped: true
      };
    }
    
    // Add summary
    console.log('[diagnoseAuth] Compiling results');
    result.summary = {
      success: 
        result.tests.supabaseConnection?.success &&
        result.tests.activeSession?.success &&
        result.tests.userData?.success &&
        (result.tests.profileData?.success || result.tests.profileData?.skipped),
      issues: result.issues.length,
      tests_passed: Object.values(result.tests).filter((t: any) => t.success).length,
      tests_total: Object.keys(result.tests).length
    };
    
    console.log('[diagnoseAuth] Authentication diagnosis complete');
    console.log('[diagnoseAuth] Results:', result.summary);
    
    return result;
  } catch (err: any) {
    console.error('[diagnoseAuth] Fatal error during diagnosis:', err);
    return {
      timestamp: new Date().toISOString(),
      error: err.message,
      stack: err.stack
    };
  }
} 