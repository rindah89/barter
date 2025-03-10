require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase connection details
const supabaseUrl = 'https://gwskbuserenviqctthqt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2tidXNlcmVudmlxY3R0aHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2ODY1MzYsImV4cCI6MjA1NjI2MjUzNn0.TdrV123kRCGb7sLoc5iSaLvxJy6f-w0n8ejuWBjFL7o';

// PostgreSQL connection string for direct connection
const pgConnectionString = 'postgresql://postgres.gwskbuserenviqctthqt:Dgl5qRbgLz3e1O6i@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to execute a query using Supabase
async function executeQuery(query, params = []) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_query: query,
      params: params 
    });
    
    if (error) {
      console.error('Error executing query:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

// Function to list tables
async function listTables() {
  console.log('Checking available tables:');
  
  const tables = ['profiles', 'items', 'trades', 'messages'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        console.log(`- Table '${table}': Error - ${error.message}`);
      } else {
        const count = data?.count || 0;
        console.log(`- Table '${table}': ${count} rows`);
      }
    } catch (err) {
      console.log(`- Table '${table}': Error - ${err.message}`);
    }
  }
}

// Function to run a custom query
async function runCustomQuery(query) {
  try {
    const { data, error } = await supabase.rpc('run_sql', { query });
    
    if (error) {
      console.log('Custom SQL queries require a custom function to be set up in Supabase.');
      console.log('Error:', error.message);
      return;
    }
    
    console.log('Query result:', data);
  } catch (err) {
    console.log('Error running custom query:', err.message);
  }
}

// Main function
async function main() {
  console.log('MCP Server Connection Test');
  console.log('=========================');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Connection string for psql:', pgConnectionString);
  console.log('\nTesting connection...');
  
  try {
    // Test connection
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return;
    }
    
    console.log('Successfully connected to MCP server!');
    
    // List tables
    await listTables();
    
    console.log('\nTo connect using psql, install PostgreSQL client tools and run:');
    console.log(`psql "${pgConnectionString}"`);
    
    console.log('\nTo run a custom query, use:');
    console.log('await runCustomQuery("SELECT * FROM profiles LIMIT 5")');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

// Run the main function
main();

// Export functions for use in Cursor
module.exports = {
  supabase,
  executeQuery,
  listTables,
  runCustomQuery,
  connectionString: pgConnectionString
}; 