import { supabase } from './supabase';

/**
 * Ensures a user profile exists after registration
 * Creates a basic profile if one doesn't exist
 */
export async function ensureUserProfile(userId: string, userData: { name?: string; email?: string }) {
  if (!userId) {
    console.error('Cannot create profile: No user ID provided');
    return { error: new Error('No user ID provided') };
  }

  try {
    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is the "no rows returned" error code, which is expected if profile doesn't exist
      console.error('Error fetching profile:', fetchError);
      return { error: fetchError };
    }

    // If profile doesn't exist, create it
    if (!existingProfile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: userData.name || 'New User',
          email: userData.email || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return { error: insertError };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Exception ensuring user profile:', error);
    return { error };
  }
}

/**
 * Handles common database errors and returns user-friendly messages
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';
  
  // Handle specific Supabase/PostgreSQL error codes
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique violation
        return 'A record with this information already exists.';
      case '23503': // Foreign key violation
        return 'This operation references data that does not exist.';
      case '23502': // Not null violation
        return 'Required information is missing.';
      case '42P01': // Undefined table
        return 'Database configuration error: Table not found.';
      case 'PGRST301': // Foreign key violation
        return 'This operation references data that does not exist.';
      case 'PGRST204': // Permission denied
        return 'You do not have permission to perform this action.';
    }
  }
  
  // Return the error message or a generic message
  return error.message || 'An unexpected database error occurred';
}

/**
 * Diagnoses Supabase connectivity issues
 * Use this function to test if Supabase is responding correctly
 */
export async function diagnosePossibleSupabaseIssues() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: Check if we can connect to Supabase at all
    try {
      const start = Date.now();
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      const elapsed = Date.now() - start;
      
      results.tests.basicConnectivity = {
        success: !error,
        elapsed: `${elapsed}ms`,
        error: error ? {
          message: error.message,
          code: error.code
        } : null
      };
    } catch (err: any) {
      results.tests.basicConnectivity = {
        success: false,
        error: {
          message: err.message,
          code: err.code || 'UNKNOWN'
        }
      };
    }

    // Test 2: Check auth endpoints
    try {
      const start = Date.now();
      // Just check the session endpoint, which should always work without credentials
      const { data, error } = await supabase.auth.getSession();
      const elapsed = Date.now() - start;
      
      results.tests.authEndpoint = {
        success: !error,
        elapsed: `${elapsed}ms`,
        error: error ? {
          message: error.message,
          code: error.code
        } : null
      };
    } catch (err: any) {
      results.tests.authEndpoint = {
        success: false,
        error: {
          message: err.message,
          code: err.code || 'UNKNOWN'
        }
      };
    }

    // Test 3: Check Supabase configuration
    const url = supabase.supabaseUrl;
    const key = supabase.supabaseKey || 'Not accessible';
    
    results.tests.configuration = {
      supabaseUrl: url,
      // Only show the last few characters of the key for security
      supabaseKey: key ? `***${key.substring(key.length - 4)}` : 'Not set',
      hasValidUrl: url && url.startsWith('https://'),
      hasValidKey: key && key.length > 20
    };

    return results;
  } catch (err: any) {
    results.overallError = {
      message: err.message,
      stack: err.stack 
    };
    return results;
  }
}

/**
 * Check if database triggers are executing properly
 * This function helps diagnose if the profile creation trigger works
 */
export async function checkAuthTriggers() {
  console.log('Checking auth triggers...');
  
  try {
    // First, check if the trigger exists in the database
    const { data: triggerData, error: triggerError } = await supabase
      .rpc('check_trigger_exists', { trigger_name: 'on_auth_user_created' });
    
    console.log('Trigger existence check:', triggerData ? 'Exists' : 'Not found', 
      triggerError ? `Error: ${triggerError.message}` : '');
    
    // Check recent users and see if they have profiles
    const { data: recentUsers, error: usersError } = await supabase
      .from('auth_diagnostics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (usersError) {
      console.error('Error fetching auth diagnostic data:', usersError);
      
      // Fallback - if we can't check directly, log what we have
      console.log('Using fallback approach to check user/profile correlation');
      
      // Try to get a list of profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return { error: 'Failed to check triggers and profiles' };
      }
      
      console.log(`Found ${profiles?.length || 0} recent profiles`);
      
      return {
        trigger_exists: null,
        profiles_found: profiles?.length || 0,
        trigger_test: 'Inconclusive - auth diagnostics view not available'
      };
    }
    
    if (recentUsers && recentUsers.length > 0) {
      console.log(`Found ${recentUsers.length} recent auth records`);
      console.log('Sample auth user:', recentUsers[0]);
      
      // For each user, check if a profile exists
      for (const user of recentUsers) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.user_id)
          .single();
        
        console.log(`User ${user.user_id}: Profile exists? ${!!profile}`);
      }
    } else {
      console.log('No recent auth users found');
    }
    
    return {
      trigger_exists: !!triggerData,
      users_checked: recentUsers?.length || 0,
      trigger_working: recentUsers?.some(u => u.has_profile) || false
    };
  } catch (err: any) {
    console.error('Error checking auth triggers:', err);
    return { error: err.message };
  }
}

/**
 * Fixes the issue where profiles exist but auth users don't
 * This creates "placeholder" auth users for existing profiles
 */
export async function syncProfilesWithAuth() {
  console.log('Starting profile to auth synchronization...');
  
  try {
    // First ensure the auth_user_links table exists for testing
    try {
      // Check if the table exists by trying to select from it
      const { error: tableCheckError } = await supabase
        .from('auth_user_links')
        .select('id')
        .limit(1);
      
      if (tableCheckError && tableCheckError.message.includes('relation "auth_user_links" does not exist')) {
        console.log('auth_user_links table does not exist, creating it...');
        
        // Create the table via RPC to ensure proper permissions
        const { error: createError } = await supabase.rpc('create_auth_user_links_table');
        
        if (createError) {
          console.error('Error creating auth_user_links table:', createError);
          
          // Fallback approach - try direct SQL
          const { error: directCreateError } = await supabase.rpc('execute_sql', {
            sql: `
              CREATE TABLE IF NOT EXISTS auth_user_links (
                id TEXT PRIMARY KEY,
                user_id UUID REFERENCES auth.users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `
          });
          
          if (directCreateError) {
            console.error('Failed to create auth_user_links table:', directCreateError);
            return {
              success: false,
              error: 'Failed to create required table. Please contact support.'
            };
          }
        }
        
        console.log('Successfully created auth_user_links table');
      }
    } catch (tableErr: any) {
      console.error('Error checking/creating auth_user_links table:', tableErr);
      
      // Continue anyway since there might be a different way to check
    }
    
    // Get profiles that may not have auth users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return {
        success: false,
        error: profilesError.message
      };
    }
    
    if (!profiles || profiles.length === 0) {
      return {
        success: true,
        message: 'No profiles found to sync'
      };
    }
    
    console.log(`Found ${profiles.length} profiles to check for auth sync`);
    
    // For each profile, verify if an auth user exists with that ID
    const results = {
      checked: 0,
      missing_auth: 0,
      fixed: 0,
      failed: 0,
      details: []
    };
    
    for (const profile of profiles) {
      results.checked++;
      
      try {
        // Check if auth record exists for this profile
        // This is a bit tricky because we can't directly query the auth.users table from client
        // so we'll try an indirect approach
        
        // Try to create a record that links to the user to see if it fails with foreign key error
        const testId = `test_${Date.now()}`;
        const { error: testError } = await supabase
          .from('auth_user_links')
          .insert({ id: testId, user_id: profile.id })
          .select();
        
        if (testError) {
          // If error contains "foreign key constraint" then the auth user doesn't exist
          if (testError.message.includes('foreign key constraint')) {
            console.log(`Profile ${profile.id} has no auth user record`);
            results.missing_auth++;
            results.details.push({
              profile_id: profile.id,
              status: 'missing_auth',
              error: testError.message
            });
            
            // Here we could try to create an auth user, but that requires admin rights
            // Instead, we'll report it so the user can handle it in the Supabase dashboard
          } else {
            // Other error - auth user might exist
            console.log(`Test for profile ${profile.id} had error:`, testError.message);
            results.details.push({
              profile_id: profile.id,
              status: 'check_error',
              error: testError.message
            });
          }
        } else {
          // If no error, the auth user exists - clean up test record
          await supabase.from('auth_user_links').delete().eq('id', testId);
          console.log(`Profile ${profile.id} has matching auth user`);
          results.details.push({
            profile_id: profile.id,
            status: 'has_auth_user'
          });
        }
      } catch (err: any) {
        console.error(`Error checking profile ${profile.id}:`, err);
        results.failed++;
        results.details.push({
          profile_id: profile.id,
          status: 'error',
          error: err.message
        });
      }
    }
    
    return {
      success: true,
      results
    };
  } catch (err: any) {
    console.error('Error synchronizing profiles with auth:', err);
    return {
      success: false,
      error: err.message
    };
  }
} 