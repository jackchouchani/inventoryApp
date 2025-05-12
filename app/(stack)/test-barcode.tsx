import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { BarcodeTestScanner } from '../../src/components/BarcodeTestScanner';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../src/utils/theme';

const TestBarcodePage = () => {
  const router = useRouter();
  const [showScanner, setShowScanner] = React.useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {showScanner ? (
        <BarcodeTestScanner onClose={() => setShowScanner(false)} />
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Test Scanner Code-barres</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.content}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Pourquoi cet outil ?</Text>
              <Text style={styles.infoText}>
                Cette page permet de tester la détection des codes-barres par la caméra, 
                en particulier pour les codes Code128 qui sont utilisés pour les articles.
              </Text>
            </View>
            
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Comment tester ?</Text>
              <Text style={styles.instructionsText}>
                1. Lancez le scanner en cliquant sur le bouton ci-dessous.{'\n'}
                2. Autorisez l'accès à la caméra si demandé.{'\n'}
                3. Présentez un code-barres à la caméra.{'\n'}
                4. Les codes détectés s'afficheront dans la liste de résultats.
              </Text>
              <Text style={styles.warningText}>
                Assurez-vous que le code-barres est bien éclairé et centré dans le cadre.
              </Text>
            </View>
            
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Conseils pour le web</Text>
              <Text style={styles.tipsText}>
                • Utilisez un navigateur récent (Chrome recommandé).{'\n'}
                • Tenez le code-barres bien droit et centré.{'\n'}
                • Évitez les reflets et assurez un bon éclairage.{'\n'}
                • Rapprochez le code-barres si nécessaire.
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={() => setShowScanner(true)}
            >
              <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
              <Text style={styles.scanButtonText}>Démarrer le test</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#f44336',
    fontStyle: 'italic',
  },
  tipsCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#388e3c',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  scanButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TestBarcodePage; 