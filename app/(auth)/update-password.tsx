import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/config/supabase';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';
import * as Sentry from '@sentry/react-native';
import ThemeToggle from '../../src/components/ThemeToggle';
import { Icon } from '../../src/components';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { verified, email: paramEmail } = params;
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        setIsLoading(true);
        let userEmail = paramEmail as string || null;
        
        if (!userEmail && Platform.OS === 'web') {
          userEmail = localStorage.getItem('reset_email');
        }
        
        if (userEmail) setEmail(userEmail);
        
        if (verified === 'true' && userEmail) {
          setIsLoading(false);
          return;
        }
        
        setError('Veuillez d\'abord vérifier votre email avec le code reçu.');
      } catch {
        setError('Une erreur est survenue. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkVerification();
  }, [verified, paramEmail]);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mots de passe différents', 'Les mots de passe doivent être identiques.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (!email) {
      Alert.alert('Erreur', 'Email non disponible. Veuillez recommencer.');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      await supabase.auth.signOut();
      
      if (Platform.OS === 'web') {
        localStorage.removeItem('reset_email');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password updated successfully',
        level: 'info'
      });

      Alert.alert(
        'Mot de passe mis à jour',
        'Votre mot de passe a été mis à jour. Veuillez vous reconnecter.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'update_password' } });
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      Alert.alert('Erreur', `Impossible de mettre à jour: ${errorMessage}.`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.centeredText}>Vérification...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Erreur</Text>
          <Text style={[styles.subtitle, { color: activeTheme.danger.main }]}>{error}</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            <Text style={styles.buttonText}>Demander un nouveau lien</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Nouveau mot de passe</Text>
          <Text style={styles.subtitle}>Veuillez entrer votre nouveau mot de passe.</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!isUpdating}
              placeholderTextColor={activeTheme.text.secondary}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon name={showPassword ? 'visibility' : 'visibility_off'} size={24} color={activeTheme.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!isUpdating}
              placeholderTextColor={activeTheme.text.secondary}
              onSubmitEditing={handleUpdatePassword}
              returnKeyType="done"
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Icon name={showConfirmPassword ? 'visibility' : 'visibility_off'} size={24} color={activeTheme.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, isUpdating && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color={activeTheme.text.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Mettre à jour</Text>
            )}
          </TouchableOpacity>
          
          <ThemeToggle />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  centeredText: {
    textAlign: 'center',
    marginTop: 16,
    color: theme.text.primary,
    fontSize: 16,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    ...theme.shadows.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.text.secondary,
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 16,
    paddingRight: 50,
    fontSize: 16,
    color: theme.text.primary,
    backgroundColor: theme.backgroundSecondary,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 13,
    padding: 5,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.sm,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
