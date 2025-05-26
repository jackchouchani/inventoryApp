import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/config/supabase';
import { theme } from '../../src/utils/theme';
import * as Sentry from '@sentry/react-native';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();

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

      console.log('Envoi d\'un code OTP à:', email);
      
      // Envoyer un code OTP par email
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          // Ne pas rediriger automatiquement, nous allons vérifier le code manuellement
          shouldCreateUser: false
        }
      });
      
      if (error) {
        console.error('Erreur lors de l\'envoi du code OTP:', error);
        throw error;
      }

      console.log('Code OTP envoyé avec succès à:', email);
      setEmailSent(true);
      
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password reset OTP sent',
        level: 'info'
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      Sentry.captureException(error, {
        tags: { action: 'password_reset_otp' }
      });

      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de l\'envoi du code de réinitialisation. Veuillez réessayer.'
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
      
      console.log('Vérification du code OTP pour:', email);
      
      // Vérifier le code OTP
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email'
      });
      
      if (error) {
        console.error('Erreur lors de la vérification du code OTP:', error);
        throw error;
      }
      
      console.log('Code OTP vérifié avec succès');
      
      // Stocker l'email vérifié dans le stockage local pour la réinitialisation
      localStorage.setItem('reset_email', email);
      
      // Déconnecter l'utilisateur pour éviter la redirection automatique
      await supabase.auth.signOut();
      
      // Rediriger vers la page de mise à jour du mot de passe
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
      console.error('Error verifying OTP:', error);
      
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

  if (emailSent) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Code envoyé</Text>
            <Text style={styles.subtitle}>
              Un code de réinitialisation a été envoyé à {email}. 
              Veuillez vérifier votre boîte de réception et saisir le code ci-dessous.
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
              placeholderTextColor="#999"
            />
            
            <TouchableOpacity 
              style={[styles.button, verifying && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
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
            
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => router.back()}
              disabled={verifying}
            >
              <Text style={styles.linkText}>Retour à la connexion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Entrez votre adresse email pour recevoir un code de réinitialisation
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
          placeholderTextColor="#999"
        />
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Envoyer le code de réinitialisation</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.linkButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.linkText}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
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
