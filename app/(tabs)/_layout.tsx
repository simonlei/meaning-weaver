import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6B5B4F',
        tabBarInactiveTintColor: '#BBB',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5E5',
        },
        headerStyle: {
          backgroundColor: '#FAF7F4',
        },
        headerTitleStyle: {
          color: '#333',
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '碎片',
          headerTitle: '意义编织',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>✏️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: '周报',
          headerTitle: '生活洞察',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📖</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          headerTitle: '设置',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}
