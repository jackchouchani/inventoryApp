import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/config/supabase';
import { theme } from '../../src/utils/theme';
import * as Sentry from '@sentry/react-native';

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

  useEffect(() => {
    const checkVerification = async () => {
      try {
        setIsLoading(true);
        console.log('Vérification de l\'accès à la page de réinitialisation');
        
        // Récupérer l'email depuis les paramètres ou le stockage local
        let userEmail = paramEmail as string || null;
        
        if (!userEmail && Platform.OS === 'web') {
          userEmail = localStorage.getItem('reset_email');
        }
        
        if (userEmail) {
          setEmail(userEmail);
        }
        
        // Vérifier si l'utilisateur a été vérifié via OTP
        if (verified === 'true' && userEmail) {
          console.log('Accès autorisé: l\'utilisateur a été vérifié par OTP');
          setIsLoading(false);
          return;
        }
        
        // Si l'utilisateur n'a pas été vérifié correctement, rediriger vers la page de récupération
        console.log('Accès non autorisé, redirection vers la page de récupération');
        setError('Veuillez d\'abord vérifier votre email avec le code reçu.');
      } catch (err) {
        console.error('Erreur lors de la vérification de l\'accès:', err);
        setError('Une erreur est survenue. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkVerification();
  }, [verified, paramEmail, router]);

  const handleUpdatePassword = async () => {
    // Validation des champs
    if (!password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      // Message d'erreur explicite pour les mots de passe qui ne correspondent pas
      Alert.alert(
        'Mots de passe différents', 
        'Le mot de passe et sa confirmation doivent être identiques.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!email) {
      Alert.alert('Erreur', 'Email non disponible. Veuillez recommencer le processus.');
      return;
    }

    setIsUpdating(true);

    try {
      console.log('Tentative de mise à jour du mot de passe pour:', email);
      
      // Utiliser directement l'API de mise à jour du mot de passe
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Erreur lors de la mise à jour du mot de passe:', error);
        throw error;
      }
      
      console.log('Mot de passe mis à jour avec succès');
      
      // Déconnexion pour forcer une nouvelle connexion avec le nouveau mot de passe
      await supabase.auth.signOut();
      
      // Nettoyer le stockage local
      if (Platform.OS === 'web') {
        localStorage.removeItem('reset_email');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password updated successfully',
        level: 'info'
      });

      // Afficher un message de succès pour la mise à jour du mot de passe
      Alert.alert(
        'Mot de passe mis à jour',
        'Votre mot de passe a été mis à jour avec succès. Veuillez vous reconnecter avec votre nouveau mot de passe.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('Redirection vers la page de connexion');
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error updating password:', error);
      
      Sentry.captureException(error, {
        tags: { action: 'update_password' }
      });

      // Message d'erreur plus spécifique
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      
      Alert.alert(
        'Erreur',
        `Impossible de mettre à jour le mot de passe: ${errorMessage}. Veuillez réessayer.`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 16 }]}>
            Vérification du lien de réinitialisation...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Erreur</Text>
          <Text style={[styles.subtitle, { color: 'red' }]}>{error}</Text>
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
          <Text style={styles.subtitle}>
            Veuillez entrer votre nouveau mot de passe ci-dessous.
          </Text>
          
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
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
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
              placeholderTextColor="#999"
              onSubmitEditing={handleUpdatePassword}
              returnKeyType="done"
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Text>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, isUpdating && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Mettre à jour le mot de passe</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => router.replace('/(auth)/login')}
            disabled={isUpdating}
          >
            <Text style={styles.linkText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 16,
    paddingRight: 50, // Espace pour l'icône
    fontSize: 16,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 13,
    padding: 5,
  },
  button: {
    backgroundColor: theme.colors.primary,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    padding: 12,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});
