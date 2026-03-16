import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FotosScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ color: '#6B8F6B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TOP TUINEN
        </Text>
        <Text style={{ color: '#E8E8E8', fontSize: 22, fontWeight: '600', marginTop: 4 }}>
          Foto's
        </Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#555', fontSize: 13 }}>Foto's worden hier geladen...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
