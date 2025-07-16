import React, { useState, useCallback, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { authService } from '../../src/services/authService';
import { checkNetworkConnection } from '../../src/utils/networkUtils';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-toast-message';
import { useAuthValidation } from '../../src/hooks/useAuthValidation';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';
import ThemeToggle from '../../src/components/ThemeToggle';

const REGISTER_TIMEOUT = 15000;

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { validateEmail, validatePassword, validatePasswordConfirmation, showValidationError } = useAuthValidation();
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);

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

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
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

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Inscription</Text>
          <ThemeToggle />
          
          <TextInput
            style={[styles.input, loading && styles.inputDisabled]}
            placeholder="Email"
            placeholderTextColor={activeTheme.text.secondary}
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
            placeholderTextColor={activeTheme.text.secondary}
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
            placeholderTextColor={activeTheme.text.secondary}
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
              <ActivityIndicator color={activeTheme.text.onPrimary} />
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
    </ScrollView>
  );
}

const createStyles = (theme: AppThemeType) => StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  formContainer: {
    backgroundColor: theme.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    color: theme.text.primary,
  },
  input: {
    backgroundColor: theme.backgroundSecondary,
    height: 50,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: theme.typography.body.fontSize,
    color: theme.text.primary,
  },
  button: {
    backgroundColor: theme.primary,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: theme.primary,
    opacity: 0.6,
  },
  buttonText: {
    color: theme.text.onPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  link: {
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
  },
  linkText: {
    color: theme.primary,
    fontSize: theme.typography.caption.fontSize,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  inputDisabled: {
    backgroundColor: theme.background,
    opacity: 0.7,
  },
}); 