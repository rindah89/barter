require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and anon key from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase configuration. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env file.'
  );
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey ? '***' + supabaseAnonKey.substring(supabaseAnonKey.length - 6) : 'Not set');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
  try {
    console.log('\nTesting Supabase connection...');
    
    // Test a simple query to check if we can connect
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
    } else {
      console.log('Successfully connected to Supabase!');
      console.log('Session:', data.session ? 'Active' : 'None');
    }
    
    // Try to execute a raw SQL query to list tables
    console.log('\nAttempting to list tables using SQL query...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('list_tables');
    
    if (tablesError) {
      console.log('Error listing tables using RPC:', tablesError.message);
      console.log('This is expected if the list_tables function is not defined in your database.');
    } else {
      console.log('Tables in the database:');
      console.log(tables);
    }
    
    // Try to query some common tables
    console.log('\nChecking for common tables:');
    const commonTables = [
      'profiles',
      'items',
      'trades',
      'messages',
      'users',
      'auth.users'
    ];
    
    for (const table of commonTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`- Table '${table}': ${error.message}`);
        } else {
          console.log(`- Table '${table}': Exists and accessible`);
        }
      } catch (err) {
        console.log(`- Table '${table}': Error - ${err.message}`);
      }
    }
    
  } catch (err) {
    console.error('Error testing Supabase connection:', err);
  }
}

// Run the test
testSupabaseConnection(); 