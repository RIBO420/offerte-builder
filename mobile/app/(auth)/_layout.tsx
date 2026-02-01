import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Inloggen',
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          title: 'Verificatie',
          // Voorkom terug navigeren tijdens verificatie
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="biometric"
        options={{
          title: 'Biometrische Setup',
          // Voorkom terug navigeren na biometric setup
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="biometric-login"
        options={{
          title: 'Biometrisch Inloggen',
        }}
      />
    </Stack>
  );
}
