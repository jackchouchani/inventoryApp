import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter, Link } from 'expo-router';
import { supabase } from '../../src/config/supabase';
import { handleAuthenticationError, handleAuthValidationError } from '../../src/utils/authErrorHandler';
import { checkNetworkConnection } from '../../src/utils/errorHandler';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const validateForm = () => {
    if (!email.trim()) {
      handleAuthValidationError('email', 'login.validateForm');
      return false;
    }
    if (!password.trim()) {
      handleAuthValidationError('password', 'login.validateForm');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Vérifier la connexion réseau
      const isConnected = await checkNetworkConnection();
      if (!isConnected) return;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        router.replace('/(tabs)/stock');
      }
    } catch (error) {
      handleAuthenticationError(error as Error, 'login.handleLogin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/Logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </TouchableOpacity>

      <View style={styles.linkContainer}>
        <Text style={styles.linkText}>Pas encore de compte ? </Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>S'inscrire</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#666',
  },
  link: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 40
  },
});
