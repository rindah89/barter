import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Repeat, User, MessageCircle } from 'lucide-react-native';
import AuthGuard from '../auth/AuthGuard';
import { Platform, View } from 'react-native';
import { uploadFile, getSupabaseFileUrl } from '@/services/imageservice';

export default function TabsLayout() {
  console.log('[TabsLayout] Rendering tabs layout');
  
  useEffect(() => {
    console.log('[TabsLayout] Tabs layout useEffect running');
  }, []);

  console.log('[TabsLayout] About to render AuthGuard');
  return (
    <AuthGuard>
      {console.log('[TabsLayout] Inside AuthGuard children')}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#22C55E',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 4,
          },
          tabBarStyle: {
            borderTopWidth: 0,
            elevation: 8,
            height: 65,
            paddingTop: 6,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              },
              android: {
                elevation: 8,
              },
            }),
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
          headerShown: false,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
              }}>
                <Home color={color} size={size} strokeWidth={2.5} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="my-items"
          options={{
            title: 'My Items',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
              }}>
                <ShoppingBag color={color} size={size} strokeWidth={2.5} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="trades"
          options={{
            title: 'Trades',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
              }}>
                <Repeat color={color} size={size} strokeWidth={2.5} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
              }}>
                <MessageCircle color={color} size={size} strokeWidth={2.5} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
              }}>
                <User color={color} size={size} strokeWidth={2.5} />
              </View>
            ),
            href: null,
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}