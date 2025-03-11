/**
 * LogCapture.tsx
 * Utility for capturing and displaying console logs
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';

// Store for recent logs
const logStore: {
  logs: Array<{
    timestamp: Date;
    type: 'log' | 'info' | 'warn' | 'error';
    message: string;
    args: any[];
  }>;
} = {
  logs: [],
};

// Maximum number of logs to store
const MAX_STORED_LOGS = 100;

// Original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Flag to track if console has been overridden
let isConsoleOverridden = false;

// Override console methods to capture logs
export function captureConsoleLogs() {
  if (isConsoleOverridden) {
    return;
  }
  
  isConsoleOverridden = true;
  
  // Override console.log
  console.log = function(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logStore.logs.unshift({
      timestamp: new Date(),
      type: 'log',
      message,
      args,
    });
    
    // Trim log store if it gets too large
    if (logStore.logs.length > MAX_STORED_LOGS) {
      logStore.logs = logStore.logs.slice(0, MAX_STORED_LOGS);
    }
    
    // Call original method
    originalConsole.log.apply(console, args);
  };
  
  // Override console.info
  console.info = function(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logStore.logs.unshift({
      timestamp: new Date(),
      type: 'info',
      message,
      args,
    });
    
    // Trim log store if it gets too large
    if (logStore.logs.length > MAX_STORED_LOGS) {
      logStore.logs = logStore.logs.slice(0, MAX_STORED_LOGS);
    }
    
    // Call original method
    originalConsole.info.apply(console, args);
  };
  
  // Override console.warn
  console.warn = function(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logStore.logs.unshift({
      timestamp: new Date(),
      type: 'warn',
      message,
      args,
    });
    
    // Trim log store if it gets too large
    if (logStore.logs.length > MAX_STORED_LOGS) {
      logStore.logs = logStore.logs.slice(0, MAX_STORED_LOGS);
    }
    
    // Call original method
    originalConsole.warn.apply(console, args);
  };
  
  // Override console.error
  console.error = function(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logStore.logs.unshift({
      timestamp: new Date(),
      type: 'error',
      message,
      args,
    });
    
    // Trim log store if it gets too large
    if (logStore.logs.length > MAX_STORED_LOGS) {
      logStore.logs = logStore.logs.slice(0, MAX_STORED_LOGS);
    }
    
    // Call original method
    originalConsole.error.apply(console, args);
  };
}

// Restore original console methods
export function restoreConsoleLogs() {
  if (!isConsoleOverridden) {
    return;
  }
  
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  
  isConsoleOverridden = false;
}

// Clear log store
export function clearLogs() {
  logStore.logs = [];
}

// Component to display logs
export function LogViewer() {
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  const getLogColor = (type: 'log' | 'info' | 'warn' | 'error') => {
    switch (type) {
      case 'log': return '#333';
      case 'info': return '#3498db';
      case 'warn': return '#f39c12';
      case 'error': return '#e74c3c';
      default: return '#333';
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Console Logs</Text>
        <View style={styles.buttonContainer}>
          <Button title="Refresh" onPress={refresh} />
          <View style={{ width: 10 }} />
          <Button 
            title="Clear" 
            onPress={() => {
              clearLogs();
              refresh();
            }} 
          />
        </View>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {logStore.logs.length === 0 ? (
          <Text style={styles.emptyText}>No logs recorded</Text>
        ) : (
          logStore.logs.map((log, index) => (
            <View key={`${index}-${refreshKey}`} style={styles.logItem}>
              <Text style={styles.logTime}>
                {log.timestamp.toLocaleTimeString()}
              </Text>
              <Text style={[styles.logType, { color: getLogColor(log.type) }]}>
                {log.type.toUpperCase()}
              </Text>
              <Text style={[styles.logMessage, { color: getLogColor(log.type) }]}>
                {log.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 10,
  },
  logItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
  },
  logTime: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  logType: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#7f8c8d',
  },
}); 