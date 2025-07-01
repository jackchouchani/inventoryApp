import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native';
import {
  Modal,
  Portal,
  Card,
  Button,
  IconButton,
  Chip
} from 'react-native-paper';
import { useAppTheme } from '../hooks/useTheme';

interface ConflictHelpModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const ConflictHelpModal: React.FC<ConflictHelpModalProps> = ({
  visible,
  onDismiss
}) => {
  const { activeTheme } = useAppTheme();

  const styles = StyleSheet.create({
    modal: {
      margin: 20,
      maxHeight: Dimensions.get('window').height * 0.85,
      maxWidth: 600,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      backgroundColor: activeTheme.primary,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: activeTheme.text.onPrimary,
      flex: 1,
    },
    content: {
      padding: 20,
      maxHeight: Dimensions.get('window').height * 0.65,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: activeTheme.primary,
      marginBottom: 12,
    },
    sectionText: {
      fontSize: 16,
      lineHeight: 24,
      color: activeTheme.text.primary,
      marginBottom: 12,
    },
    subTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    bulletPoint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    bullet: {
      fontSize: 16,
      color: activeTheme.primary,
      marginRight: 8,
      marginTop: 4,
    },
    bulletText: {
      fontSize: 16,
      lineHeight: 24,
      color: activeTheme.text.primary,
      flex: 1,
    },
    exampleBox: {
      backgroundColor: activeTheme.surface,
      padding: 16,
      borderRadius: 8,
      marginVertical: 12,
      borderLeftWidth: 4,
      borderLeftColor: activeTheme.primary,
    },
    exampleTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: activeTheme.primary,
      marginBottom: 8,
    },
    exampleText: {
      fontSize: 15,
      lineHeight: 22,
      color: activeTheme.text.primary,
    },
    warningBox: {
      backgroundColor: activeTheme.warning + '20',
      padding: 16,
      borderRadius: 8,
      marginVertical: 12,
      borderLeftWidth: 4,
      borderLeftColor: activeTheme.warning,
    },
    warningText: {
      fontSize: 15,
      lineHeight: 22,
      color: activeTheme.text.primary,
    },
    buttonContainer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: activeTheme.border,
    },
    actionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    actionChip: {
      backgroundColor: activeTheme.surface,
    },
  });

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Card>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              💡 Comprendre les conflits de données
            </Text>
            <IconButton
              icon="close"
              size={24}
              iconColor={activeTheme.text.onPrimary}
              onPress={onDismiss}
            />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Qu'est-ce qu'un conflit ? */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🤔 Qu'est-ce qu'un conflit ?</Text>
              <Text style={styles.sectionText}>
                Un conflit arrive quand vous modifiez quelque chose dans l'app pendant que vous êtes hors ligne, 
                et qu'en même temps, quelqu'un d'autre (ou vous sur un autre appareil) modifie la même chose.
              </Text>
              
              <View style={styles.exampleBox}>
                <Text style={styles.exampleTitle}>📱 Exemple concret :</Text>
                <Text style={styles.exampleText}>
                  • Vous changez le prix d'un iPhone de 800€ à 750€ (hors ligne){'\n'}
                  • En même temps, votre collègue le marque comme "vendu" (en ligne){'\n'}
                  • Résultat : l'app ne sait pas quoi faire ! 🤷‍♀️
                </Text>
              </View>
            </View>

            {/* Types de conflits */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔄 Types de conflits courants</Text>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Modifications simultanées :</Text> Deux personnes modifient le même article
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Suppression vs modification :</Text> L'un supprime, l'autre modifie
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Articles dupliqués :</Text> Même code QR créé deux fois
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Déplacements simultanés :</Text> Article déplacé vers différents containers
                </Text>
              </View>
            </View>

            {/* Résolution automatique */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Résolution automatique ("Auto")</Text>
              <Text style={styles.sectionText}>
                L'app essaie de résoudre le conflit automatiquement selon des règles simples :
              </Text>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Suppression gagne toujours :</Text> Si quelqu'un supprime un article, il reste supprimé
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>La dernière modification gagne :</Text> Pour les prix, descriptions, etc.
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '600' }}>Fusion intelligente :</Text> Combine les modifications si possible
                </Text>
              </View>

              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ <Text style={{ fontWeight: '600' }}>Important :</Text> Certains conflits complexes nécessitent votre intervention. 
                  L'app vous demandera alors de choisir manuellement.
                </Text>
              </View>
            </View>

            {/* Résolution manuelle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Résolution manuelle</Text>
              <Text style={styles.sectionText}>
                Quand l'app ne peut pas décider automatiquement, vous avez 3 choix :
              </Text>

              <View style={styles.actionChips}>
                <Chip style={styles.actionChip} icon="arrow-left">Garder Local</Chip>
                <Chip style={styles.actionChip} icon="arrow-right">Garder Serveur</Chip>
                <Chip style={styles.actionChip} icon="merge">Fusionner</Chip>
              </View>

              <Text style={styles.subTitle}>🔧 Option "Fusionner" :</Text>
              <Text style={styles.sectionText}>
                Vous choisissez champ par champ ce que vous voulez garder. 
                Par exemple : garder le prix de votre version, mais la description de l'autre.
              </Text>
            </View>

            {/* Conseils */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Conseils pratiques</Text>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Utilisez d'abord "Auto" - ça marche dans 80% des cas
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  En cas de doute, choisissez "Fusionner" pour voir les détails
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Les modifications récentes sont souvent plus importantes
                </Text>
              </View>
              
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Contactez votre équipe en cas de conflit sur des données importantes
                </Text>
              </View>
            </View>

          </ScrollView>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={onDismiss}
              icon="check"
            >
              J'ai compris !
            </Button>
          </View>
        </Card>
      </Modal>
    </Portal>
  );
};

export default ConflictHelpModal;