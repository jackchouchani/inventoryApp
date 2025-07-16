import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { authService } from '../../src/services/authService';
import { checkNetworkConnection } from '../../src/utils/networkUtils';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-toast-message';
import { useAuthValidation } from '../../src/hooks/useAuthValidation';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';
import ThemeToggle from '../../src/components/ThemeToggle';
import Logo from '../../assets/Logo.png';

const LOGIN_TIMEOUT = 15000;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { validateEmail, validatePassword, showValidationError } = useAuthValidation();
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);

  // Nettoyage des champs lors du démontage du composant
  useEffect(() => {
    return () => {
      setEmail('');
      setPassword('');
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

    return true;
  }, [email, password, validateEmail, validatePassword, showValidationError]);

  const handleLogin = useCallback(async () => {
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
          reject(new Error('La connexion a pris trop de temps'));
        }, LOGIN_TIMEOUT);
      });

      const loginPromise = authService.signIn(email.trim(), password.trim());

      const result = await Promise.race([loginPromise, timeoutPromise]) as Awaited<ReturnType<typeof authService.signIn>>;

      if (result?.user) {
        // Attendre que la navigation soit prête
        await new Promise(resolve => setTimeout(resolve, 1000));
        router.replace('/(tabs)/stock');
      } else {
        throw new Error('Échec de la connexion');
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          location: 'login.handleLogin',
          platform: Platform.OS
        },
        extra: {
          email: email.trim()
        }
      });

      Toast.show({
        type: 'error',
        text1: 'Erreur de connexion',
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
          <Image
            source={Logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Logo de l'application"
          />
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
            textContentType="password"
            autoComplete="password"
            accessibilityLabel="Champ mot de passe"
            accessibilityHint="Entrez votre mot de passe"
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityLabel="Bouton de connexion"
            accessibilityHint="Appuyez pour vous connecter"
          >
            {loading ? (
              <ActivityIndicator color={activeTheme.text.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
          <View style={styles.links}>
            <Link 
              href="/(auth)/register" 
              style={[styles.link, loading && styles.linkDisabled]}
              accessibilityLabel="Lien vers l'inscription"
            >
              <Text style={styles.linkText}>Créer un compte</Text>
            </Link>
            <Link 
              href="/(auth)/forgot-password" 
              style={[styles.link, loading && styles.linkDisabled]}
              accessibilityLabel="Lien mot de passe oublié"
            >
              <Text style={styles.linkText}>Mot de passe oublié ?</Text>
            </Link>
          </View>
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
    padding: 20,
  },
  formContainer: {
    backgroundColor: theme.surface,
    padding: 20,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 10,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: theme.backgroundSecondary,
    fontSize: theme.typography.body.fontSize,
    color: theme.text.primary,
  },
  inputDisabled: {
    backgroundColor: theme.background,
    opacity: 0.7,
  },
  button: {
    backgroundColor: theme.primary,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
  links: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    // Styles for the TouchableOpacity wrapper if needed
  },
  linkText: {
    color: theme.primary,
    fontSize: theme.typography.caption.fontSize,
  },
  linkDisabled: {
    opacity: 0.5,
  },
});
