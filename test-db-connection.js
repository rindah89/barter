const { Client } = require('pg');

// Connection configuration
// Using the Supabase connection pooler format
const connectionString = 'postgresql://postgres.gwskbuserenviqctthqt:Dgl5qRbgLz3e1O6i@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

// Create a new client
const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
});

// Connect to the database
async function testConnection() {
  try {
    console.log('Attempting to connect to the database...');
    await client.connect();
    console.log('Successfully connected to the database!');
    
    // Query to test the connection
    const res = await client.query('SELECT version()');
    console.log('PostgreSQL version:', res.rows[0].version);
    
    // List all tables in the public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\nTables in the database:');
    tablesRes.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (err) {
    console.error('Error connecting to the database:', err);
  } finally {
    // Close the connection
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the test
testConnection(); 