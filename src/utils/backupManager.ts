import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Buffer } from 'buffer';
import { getItems, getCategories, getContainers, addItem, addCategory, addContainer, getDatabase } from '../database/database';
import { exportPhotos, importPhotos } from './photoManager';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const BACKUP_DIR = `${FileSystem.documentDirectory}backups`;
const PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;
const DB_FILENAME = 'database.json';

// Interface for tracking restoration state
interface RestorationState {
    transactionStarted: boolean;
    originalDataBackedUp: boolean;
    tempDirCreated: boolean;
    tempDir: string;
    originalBackup?: {
        items: any[];
        categories: any[];
        containers: any[];
        photos: string[];
    };
}

export const initBackupStorage = async () => {
    if (Platform.OS === 'web') {
        // Version web - pas besoin d'initialisation
        return;
    }

    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }
};

const backupCurrentState = async (): Promise<RestorationState['originalBackup']> => {
    return {
        items: await getItems(),
        categories: await getCategories(),
        containers: await getContainers(),
        photos: await exportPhotos(PHOTOS_DIR)
    };
};

const clearDatabase = async () => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM items');
    await db.runAsync('DELETE FROM containers');
    await db.runAsync('DELETE FROM categories');
};

const restoreOriginalState = async (originalState: RestorationState['originalBackup']) => {
    if (!originalState) return;
    
    const db = getDatabase();
    await db.runAsync('BEGIN TRANSACTION');
    try {
        await clearDatabase();
        
        for (const category of originalState.categories) {
            await addCategory(category);
        }
        for (const container of originalState.containers) {
            await addContainer(container);
        }
        for (const item of originalState.items) {
            await addItem(item);
        }
        
        await db.runAsync('COMMIT');
    } catch (error) {
        await db.runAsync('ROLLBACK');
        throw error;
    }
};

export const createBackup = async (): Promise<string> => {
    if (Platform.OS === 'web') {
        throw new Error('La fonctionnalité de sauvegarde n\'est pas disponible sur le web');
    }

    try {
        // Créer le répertoire de sauvegarde
        const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
        }

        // Créer le ZIP
        const zip = new JSZip();

        // Récupérer toutes les données
        const data = {
            items: await getItems(),
            categories: await getCategories(),
            containers: await getContainers()
        };

        // Ajouter les données au ZIP
        zip.file(DB_FILENAME, JSON.stringify(data, null, 2));

        // Ajouter les photos
        const photos = data.items
            .filter(item => item.photoUri)
            .map(item => item.photoUri as string);

        for (const photoUri of photos) {
            try {
                const photoContent = await FileSystem.readAsStringAsync(photoUri, {
                    encoding: FileSystem.EncodingType.Base64
                });
                const photoName = photoUri.split('/').pop();
                zip.file(`${PHOTOS_DIR}/${photoName}`, photoContent, { base64: true });
            } catch (error) {
                console.warn(`Impossible de lire la photo: ${photoUri}`, error);
            }
        }

        // Générer le ZIP
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${BACKUP_DIR}/backup-${timestamp}.zip`;
        const zipContent = await zip.generateAsync({ type: 'base64' });

        // Sauvegarder le ZIP
        await FileSystem.writeAsStringAsync(backupPath, zipContent, {
            encoding: FileSystem.EncodingType.Base64
        });

        return backupPath;
    } catch (error) {
        console.error('Erreur lors de la création de la sauvegarde:', error);
        throw error;
    }
};

export const restoreBackup = async (backupPath: string): Promise<void> => {
    if (Platform.OS === 'web') {
        throw new Error('La fonctionnalité de restauration n\'est pas disponible sur le web');
    }

    try {
        // Créer le dossier photos s'il n'existe pas
        const photosInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
        if (!photosInfo.exists) {
            await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
        }

        // Lire le fichier de sauvegarde
        const zipContent = await FileSystem.readAsStringAsync(backupPath, {
            encoding: FileSystem.EncodingType.Base64
        });

        // Extraire le ZIP
        const zip = new JSZip();
        await zip.loadAsync(zipContent, { base64: true });

        // Restaurer la base de données
        const dbFile = zip.file(DB_FILENAME);
        if (!dbFile) throw new Error('Fichier de base de données non trouvé dans la sauvegarde');

        const dbContent = await dbFile.async('string');
        const data = JSON.parse(dbContent);

        // Restaurer les photos
        for (const file of Object.keys(zip.files)) {
            if (file.startsWith('photos/')) {
                const photoFile = zip.file(file);
                if (photoFile) {
                    const photoContent = await photoFile.async('base64');
                    const photoName = file.split('/').pop()!;
                    const newPhotoPath = `${PHOTOS_DIR}/${photoName}`;
                    await FileSystem.writeAsStringAsync(
                        newPhotoPath,
                        photoContent,
                        { encoding: FileSystem.EncodingType.Base64 }
                    );
                }
            }
        }

        // Nettoyer la base de données existante
        const db = getDatabase();
        await db.runAsync('BEGIN TRANSACTION');
        
        try {
            await db.runAsync('DELETE FROM items');
            await db.runAsync('DELETE FROM categories');
            await db.runAsync('DELETE FROM containers');

            // Restaurer les données
            for (const category of data.categories) {
                await addCategory(category);
            }

            for (const container of data.containers) {
                await addContainer(container);
            }

            for (const item of data.items) {
                if (item.photoUri) {
                    const photoName = item.photoUri.split('/').pop();
                    item.photoUri = `${PHOTOS_DIR}/${photoName}`;
                }
                await addItem(item);
            }

            await db.runAsync('COMMIT');
        } catch (error) {
            await db.runAsync('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Erreur pendant la restauration:', error);
        throw new Error(`Échec de la restauration: ${error instanceof Error ? error.message : String(error)}`);
    }
};