import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/config/supabase';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';
import * as Sentry from '@sentry/react-native';
import ThemeToggle from '../../src/components/ThemeToggle';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSendOTP = useCallback(async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre adresse email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    setLoading(true);
    
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password reset OTP requested',
        level: 'info',
        data: { email: email }
      });

      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false
        }
      });
      
      if (error) throw error;

      setEmailSent(true);
      
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password reset OTP sent',
        level: 'info'
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'password_reset_otp' }
      });

      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de l\'envoi du code. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  }, [email]);
  
  const handleVerifyOTP = useCallback(async () => {
    if (!otpCode) {
      Alert.alert('Erreur', 'Veuillez entrer le code reçu par email');
      return;
    }
    
    setVerifying(true);
    
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Verifying OTP code',
        level: 'info'
      });
      
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email'
      });
      
      if (error) throw error;
      
      await supabase.auth.signOut();
      
      router.replace({
        pathname: '/(auth)/update-password',
        params: { verified: 'true', email: email }
      });
      
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'OTP verified successfully',
        level: 'info'
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'verify_otp' }
      });

      Alert.alert(
        'Erreur',
        'Le code est invalide ou a expiré. Veuillez réessayer.'
      );
    } finally {
      setVerifying(false);
    }
  }, [email, otpCode, router]);

  const renderContent = () => {
    if (emailSent) {
      return (
        <>
          <Text style={styles.title}>Code envoyé</Text>
          <Text style={styles.subtitle}>
            Un code a été envoyé à {email}. Veuillez le saisir ci-dessous.
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Code de réinitialisation"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            editable={!verifying}
            maxLength={6}
            placeholderTextColor={activeTheme.text.secondary}
          />
          
          <TouchableOpacity 
            style={[styles.button, verifying && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color={activeTheme.text.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Vérifier le code</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => setEmailSent(false)}
            disabled={verifying}
          >
            <Text style={styles.linkText}>Demander un nouveau code</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Entrez votre email pour recevoir un code de réinitialisation.
        </Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!loading}
          placeholderTextColor={activeTheme.text.secondary}
        />
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={activeTheme.text.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Envoyer le code</Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          {renderContent()}
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => router.back()}
            disabled={loading || verifying}
          >
            <Text style={styles.linkText}>Retour à la connexion</Text>
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
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    ...theme.shadows.md,
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
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: theme.text.primary,
    backgroundColor: theme.backgroundSecondary,
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
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});

