import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { authService } from '../../src/services/authService';
import { checkNetworkConnection } from '../../src/utils/networkUtils';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-toast-message';
import { useAuthValidation } from '../../src/hooks/useAuthValidation';
import { theme } from '../../src/utils/theme';
import { useMemo } from 'react';

const REGISTER_TIMEOUT = 15000;

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { validateEmail, validatePassword, validatePasswordConfirmation, showValidationError } = useAuthValidation();

  // Nettoyage des champs lors du démontage du composant
  useEffect(() => {
    return () => {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    };
  }, []);

  const validateForm = useCallback(() => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showValidationError(emailValidation.errors[0]);
      return false;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      showValidationError(passwordValidation.errors[0]);
      return false;
    }

    const confirmationValidation = validatePasswordConfirmation(password, confirmPassword);
    if (!confirmationValidation.isValid) {
      showValidationError(confirmationValidation.errors[0]);
      return false;
    }

    return true;
  }, [email, password, confirmPassword, validateEmail, validatePassword, validatePasswordConfirmation, showValidationError]);

  const handleRegister = useCallback(async () => {
    if (loading) return;
    if (!validateForm()) return;

    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      setLoading(true);

      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        Toast.show({
          type: 'error',
          text1: 'Erreur de connexion',
          text2: 'Vérifiez votre connexion internet'
        });
        return;
      }

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('La création du compte a pris trop de temps'));
        }, REGISTER_TIMEOUT);
      });

      const registerPromise = authService.signUp(email.trim(), password.trim(), '');
      const result = await Promise.race([registerPromise, timeoutPromise]) as Awaited<ReturnType<typeof authService.signUp>>;

      if (result?.user) {
        Toast.show({
          type: 'success',
          text1: 'Compte créé avec succès',
          text2: 'Veuillez vérifier votre email pour activer votre compte'
        });
        router.replace('/(tabs)/stock');
      } else {
        throw new Error('Échec de la création du compte');
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          location: 'register.handleRegister',
          platform: Platform.OS
        },
        extra: {
          email: email.trim()
        }
      });

      Toast.show({
        type: 'error',
        text1: 'Erreur d\'inscription',
        text2: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [loading, validateForm, email, password, router]);

  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Inscription</Text>
        
        <TextInput
          style={[styles.input, loading && styles.inputDisabled]}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          textContentType="emailAddress"
          autoComplete="email"
          accessibilityLabel="Champ email"
          accessibilityHint="Entrez votre adresse email"
        />

        <TextInput
          style={[styles.input, loading && styles.inputDisabled]}
          placeholder="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          textContentType="newPassword"
          autoComplete="password-new"
          accessibilityLabel="Champ mot de passe"
          accessibilityHint="Créez votre mot de passe"
        />

        <TextInput
          style={[styles.input, loading && styles.inputDisabled]}
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
          textContentType="newPassword"
          autoComplete="password-new"
          accessibilityLabel="Champ confirmation mot de passe"
          accessibilityHint="Confirmez votre mot de passe"
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityLabel="Bouton d'inscription"
          accessibilityHint="Appuyez pour créer votre compte"
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>S'inscrire</Text>
          )}
        </TouchableOpacity>

        <Link
          href="/(auth)/login"
          style={[styles.link, loading && styles.linkDisabled]}
          accessibilityLabel="Lien vers la connexion"
        >
          <Text style={styles.linkText}>
            Déjà un compte ? Se connecter
          </Text>
        </Link>
      </View>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)', elevation: 5,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: '600',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.background,
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  link: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption.fontSize,
  },
  linkDisabled: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  inputDisabled: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
}); 