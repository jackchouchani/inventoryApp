import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const PHOTO_DIR = `${FileSystem.documentDirectory}photos`;
const TEMP_DIR = `${FileSystem.cacheDirectory}temp_photos`;

// Helper function to ensure directory exists with proper permissions
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dirPath, { 
                intermediates: true 
            });
        }
        
        // On Android, explicitly set write permissions
        if (Platform.OS === 'android') {
            await FileSystem.makeDirectoryAsync(dirPath, {
                intermediates: true
            });
        }
    } catch (error) {
        console.error(`Error ensuring directory exists (${dirPath}):`, error);
        throw new Error(`Failed to create/verify directory: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// Helper function to safely copy a file with proper permissions
const safeCopyFile = async (sourceUri: string, destUri: string): Promise<void> => {
    try {
        // First, copy to temporary location
        const tempUri = `${TEMP_DIR}/${Date.now()}_${sourceUri.split('/').pop()}`;
        await FileSystem.copyAsync({
            from: sourceUri,
            to: tempUri
        });

        // Then move to final destination
        await FileSystem.moveAsync({
            from: tempUri,
            to: destUri
        });
    } catch (error) {
        console.error(`Error during safe file copy (${sourceUri} -> ${destUri}):`, error);
        throw new Error(`Failed to safely copy file: ${error.message}`);
    }
};

export const initPhotoStorage = async () => {
    await ensureDirectoryExists(PHOTO_DIR);
    await ensureDirectoryExists(TEMP_DIR);
};

const generatePhotoFilename = () => {
    return `photo_${Date.now()}.jpg`;
};

export const savePhoto = async (uri: string): Promise<string> => {
    try {
        await initPhotoStorage();

        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        const filename = generatePhotoFilename();
        const destUri = `${PHOTO_DIR}/${filename}`;

        await safeCopyFile(manipResult.uri, destUri);
        return destUri;
    } catch (error) {
        console.error('Error saving photo:', error);
        throw new Error(`Failed to save photo: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const deletePhoto = async (uri: string): Promise<void> => {
    try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
        }
    } catch (error: unknown) {
        console.error('Error deleting photo:', error);
        throw new Error(`Failed to delete photo: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getPhotoUri = (filename: string): string => {
    return `${PHOTO_DIR}/${filename}`;
};

export const exportPhotos = async (destDir: string): Promise<string[]> => {
    try {
        await ensureDirectoryExists(destDir);
        const photos = await FileSystem.readDirectoryAsync(PHOTO_DIR);
        const exportedFiles: string[] = [];

        for (const photo of photos) {
            const sourceUri = `${PHOTO_DIR}/${photo}`;
            const destUri = `${destDir}/${photo}`;

            try {
                await safeCopyFile(sourceUri, destUri);
                exportedFiles.push(photo);
            } catch (copyError) {
                console.error(`Error exporting photo ${photo}:`, copyError);
                // Continue with other files even if one fails
                continue;
            }
        }

        if (exportedFiles.length === 0 && photos.length > 0) {
            throw new Error('Failed to export any photos');
        }

        return exportedFiles;
    } catch (error) {
        console.error('Error exporting photos:', error);
        throw new Error(`Failed to export photos: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const importPhotos = async (sourceDir: string, files: string[]): Promise<void> => {
    const failedImports: string[] = [];
    
    try {
        await initPhotoStorage();
        await ensureDirectoryExists(TEMP_DIR);

        for (const file of files) {
            const sourceUri = `${sourceDir}/${file}`;
            const destUri = `${PHOTO_DIR}/${file}`;

            try {
                // First check if source file exists
                const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
                if (!sourceInfo.exists) {
                    failedImports.push(file);
                    console.error(`Source file ${file} does not exist`);
                    continue;
                }

                // Delete existing destination file if it exists
                const destInfo = await FileSystem.getInfoAsync(destUri);
                if (destInfo.exists) {
                    await FileSystem.deleteAsync(destUri, { idempotent: true });
                }

                // Use safe copy method
                await safeCopyFile(sourceUri, destUri);

                // Verify the copy was successful
                const finalInfo = await FileSystem.getInfoAsync(destUri);
                if (!finalInfo.exists) {
                    throw new Error(`File verification failed for ${file}`);
                }
            } catch (importError) {
                console.error(`Error importing file ${file}:`, importError);
                failedImports.push(file);
                continue;
            }
        }

        // Clean up temp directory
        try {
            await FileSystem.deleteAsync(TEMP_DIR, { idempotent: true });
            await ensureDirectoryExists(TEMP_DIR);
        } catch (cleanupError) {
            console.error('Error cleaning up temp directory:', cleanupError);
        }

        // Report failed imports
        if (failedImports.length > 0) {
            throw new Error(`Failed to import ${failedImports.length} files: ${failedImports.join(', ')}`);
        }
    } catch (error) {
        console.error('Error importing photos:', error);
        throw new Error(`Photo import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};