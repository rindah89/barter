const { Client } = require('pg');

// Connection details from the provided connection string
const connectionString = 'postgresql://postgres.gwskbuserenviqctthqt:Dgl5qRbgLz3e1O6i@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

async function queryDatabase() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // This might be needed for Supabase connections
    }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase database');

    // Query for functions and triggers related to messages that might contain CASE/WHEN
    console.log('\n--- Functions that might contain CASE/WHEN statements ---');
    const functionQuery = `
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM 
        pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        (p.proname ILIKE '%message%' OR p.proname ILIKE '%chat%') AND
        pg_get_functiondef(p.oid) ILIKE '%CASE%WHEN%'
      ORDER BY 
        n.nspname, p.proname;
    `;
    
    const functionResult = await client.query(functionQuery);
    
    if (functionResult.rows.length === 0) {
      console.log('No functions with CASE/WHEN statements found');
    } else {
      functionResult.rows.forEach(row => {
        console.log(`\nSchema: ${row.schema}`);
        console.log(`Function: ${row.function_name}`);
        console.log('Definition:');
        console.log(row.function_definition);
        console.log('-----------------------------------');
      });
    }

    // Query for triggers on the messages table
    console.log('\n--- Triggers on the messages table ---');
    const triggerQuery = `
      SELECT 
        t.tgname as trigger_name,
        pg_get_triggerdef(t.oid) as trigger_definition,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM 
        pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE 
        c.relname = 'messages'
      ORDER BY 
        t.tgname;
    `;
    
    const triggerResult = await client.query(triggerQuery);
    
    if (triggerResult.rows.length === 0) {
      console.log('No triggers found on the messages table');
    } else {
      triggerResult.rows.forEach(row => {
        console.log(`\nTrigger: ${row.trigger_name}`);
        console.log(`Definition: ${row.trigger_definition}`);
        console.log(`Function: ${row.function_name}`);
        console.log('Function Definition:');
        console.log(row.function_definition);
        console.log('-----------------------------------');
      });
    }

    // Query for the mark_messages_as_read function specifically
    console.log('\n--- mark_messages_as_read function ---');
    const markMessagesQuery = `
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM 
        pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        p.proname = 'mark_messages_as_read'
      LIMIT 1;
    `;
    
    const markMessagesResult = await client.query(markMessagesQuery);
    
    if (markMessagesResult.rows.length === 0) {
      console.log('mark_messages_as_read function not found');
    } else {
      const row = markMessagesResult.rows[0];
      console.log(`Schema: ${row.schema}`);
      console.log(`Function: ${row.function_name}`);
      console.log('Definition:');
      console.log(row.function_definition);
    }

    // Query for the create_message_read_status function
    console.log('\n--- create_message_read_status function ---');
    const createReadStatusQuery = `
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM 
        pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        p.proname = 'create_message_read_status'
      LIMIT 1;
    `;
    
    const createReadStatusResult = await client.query(createReadStatusQuery);
    
    if (createReadStatusResult.rows.length === 0) {
      console.log('create_message_read_status function not found');
    } else {
      const row = createReadStatusResult.rows[0];
      console.log(`Schema: ${row.schema}`);
      console.log(`Function: ${row.function_name}`);
      console.log('Definition:');
      console.log(row.function_definition);
    }

  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

queryDatabase(); 