import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Buffer } from 'buffer';
import { getItems, getCategories, getContainers, addItem, addCategory, addContainer, getDatabase } from '../database/database';
import { exportPhotos, importPhotos } from './photoManager';

const BACKUP_DIR = `${FileSystem.documentDirectory}backups`;
const PHOTOS_DIR = 'photos';
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

export const createBackup = async () => {
    const tempDir = `${FileSystem.cacheDirectory}backup_temp_${Date.now()}`;
    let tempBackupPath: string | undefined;

    try {
        await initBackupStorage();

        const backupFileName = `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        tempBackupPath = `${FileSystem.cacheDirectory}${backupFileName}`;
        
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
        const photosBackupDir = `${tempDir}/${PHOTOS_DIR}`;
        await FileSystem.makeDirectoryAsync(photosBackupDir);

        // Backup database and photos
        const dbData = {
            items: await getItems(),
            categories: await getCategories(),
            containers: await getContainers()
        };
        
        await FileSystem.writeAsStringAsync(
            `${tempDir}/${DB_FILENAME}`,
            JSON.stringify(dbData, null, 2)
        );

        const exportedPhotos = await exportPhotos(photosBackupDir);
        const zip = new JSZip();
        
        // Add database to zip
        const dbContent = await FileSystem.readAsStringAsync(`${tempDir}/${DB_FILENAME}`);
        zip.file(DB_FILENAME, dbContent);

        // Add photos to zip
        for (const photo of exportedPhotos) {
            const photoContent = await FileSystem.readAsStringAsync(
                `${photosBackupDir}/${photo}`,
                { encoding: FileSystem.EncodingType.Base64 }
            );
            zip.file(`${PHOTOS_DIR}/${photo}`, photoContent, { base64: true });
        }

        const zipContent = await zip.generateAsync({ type: 'base64' });
        await FileSystem.writeAsStringAsync(tempBackupPath, zipContent, {
            encoding: FileSystem.EncodingType.Base64
        });

        if (!(await Sharing.isAvailableAsync())) {
            throw new Error('Sharing is not available on this platform');
        }

        await Sharing.shareAsync(tempBackupPath, {
            mimeType: 'application/zip',
            dialogTitle: 'Save Backup File',
            UTI: 'public.zip-archive'
        });

        return tempBackupPath;
    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    } finally {
        // Clean up temporary files
        if (tempDir) {
            await FileSystem.deleteAsync(tempDir, { idempotent: true });
        }
        if (tempBackupPath) {
            await FileSystem.deleteAsync(tempBackupPath, { idempotent: true });
        }
    }
};

export const restoreBackup = async (backupPath: string): Promise<void> => {
    const state: RestorationState = {
        transactionStarted: false,
        originalDataBackedUp: false,
        tempDirCreated: false,
        tempDir: `${FileSystem.cacheDirectory}restore_temp_${Date.now()}`
    };

    try {
        // Step 1: Create temporary directory
        await FileSystem.makeDirectoryAsync(state.tempDir, { intermediates: true });
        state.tempDirCreated = true;

        // Step 2: Backup current state
        state.originalBackup = await backupCurrentState();
        state.originalDataBackedUp = true;

        // Step 3: Read and validate backup file
        const zipContent = await FileSystem.readAsStringAsync(backupPath, {
            encoding: FileSystem.EncodingType.Base64
        });

        const zip = new JSZip();
        await zip.loadAsync(zipContent, { base64: true });

        const dbFile = zip.file(DB_FILENAME);
        if (!dbFile) throw new Error('Database file not found in backup');

        const dbContent = await dbFile.async('string');
        const dbData = JSON.parse(dbContent);

        if (!dbData.categories || !dbData.containers || !dbData.items) {
            throw new Error('Invalid backup file structure');
        }

        // Step 4: Extract photos
        const photosDir = `${state.tempDir}/${PHOTOS_DIR}`;
        await FileSystem.makeDirectoryAsync(photosDir);

        const photoFiles: string[] = [];
        for (const file of Object.keys(zip.files)) {
            if (file.startsWith(PHOTOS_DIR + '/')) {
                const photoFile = zip.file(file);
                if (photoFile) {
                    const photoContent = await photoFile.async('base64');
                    const photoName = file.split('/').pop()!;
                    await FileSystem.writeAsStringAsync(
                        `${photosDir}/${photoName}`,
                        photoContent,
                        { encoding: FileSystem.EncodingType.Base64 }
                    );
                    photoFiles.push(photoName);
                }
            }
        }

        // Step 5: Begin database transaction
        const db = getDatabase();
        await db.runAsync('BEGIN TRANSACTION');
        state.transactionStarted = true;

        // Step 6: Restore data
        await clearDatabase();
        await importPhotos(photosDir, photoFiles);

        for (const category of dbData.categories) {
            await addCategory(category);
        }

        for (const container of dbData.containers) {
            await addContainer(container);
        }

        for (const item of dbData.items) {
            await addItem(item);
        }

        // Step 7: Commit transaction
        await db.runAsync('COMMIT');
        state.transactionStarted = false;

    } catch (error) {
        console.error('Error during backup restoration:', error);

        // Handle transaction rollback if needed
        if (state.transactionStarted) {
            try {
                const db = getDatabase();
                await db.runAsync('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error during transaction rollback:', rollbackError);
            }
        }

        // Attempt to restore original state if we have a backup
        if (state.originalDataBackedUp && state.originalBackup) {
            try {
                await restoreOriginalState(state.originalBackup);
            } catch (restoreError) {
                console.error('Error restoring original state:', restoreError);
                throw new Error('Critical error: Failed to restore original state after backup failure');
            }
        }

        throw error;
    } finally {
        // Clean up temporary directory
        if (state.tempDirCreated) {
            try {
                await FileSystem.deleteAsync(state.tempDir, { idempotent: true });
            } catch (cleanupError) {
                console.error('Error cleaning up temporary files:', cleanupError);
            }
        }
    }
};