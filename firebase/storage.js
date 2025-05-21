import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './config';
import * as FileSystem from 'expo-file-system';

/**
 * Upload an image to Firebase Storage
 * @param {string} uri - Local URI of the image
 * @param {string} path - Firebase Storage path
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<string>} - Download URL of the uploaded image
 */
const uploadImage = async (uri, path, onProgress) => {
  try {
    // Get the file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    // Get the file name from the URI
    const fileName = uri.split('/').pop();
    const fileExtension = fileName.split('.').pop();
    
    // Read the file as a blob
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        resolve(xhr.response);
      };
      xhr.onerror = (e) => {
        reject(new Error('Network request failed'));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
    
    // Create a storage reference
    const storageRef = ref(storage, path);
    
    // Upload the file
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    // Listen for state changes, errors, and completion
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Get upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          // Handle upload error
          blob.close();
          reject(error);
        },
        async () => {
          // Upload completed successfully, get download URL
          blob.close();
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Upload a profile image to Firebase Storage
 * @param {string} userId - User ID
 * @param {string} uri - Local URI of the image
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<string>} - Download URL of the uploaded image
 */
export const uploadProfileImage = async (userId, uri, onProgress = undefined) => {
  const path = `profileImages/${userId}/${uri.split('/').pop()}`;
  return await uploadImage(uri, path, onProgress);
};

/**
 * Upload a background image to Firebase Storage
 * @param {string} userId - User ID
 * @param {string} uri - Local URI of the image
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<string>} - Download URL of the uploaded image
 */
export const uploadBackgroundImage = async (userId, uri, onProgress = undefined) => {
  const path = `backgroundImages/${userId}/${uri.split('/').pop()}`;
  return await uploadImage(uri, path, onProgress);
};

/**
 * Delete all storage files associated with a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const deleteUserStorageFiles = async (userId) => {
  try {
    console.log(`Deleting storage files for user: ${userId}`);
    
    // Delete profile images
    const profileImagesRef = ref(storage, `profileImages/${userId}`);
    try {
      const profileList = await listAll(profileImagesRef);
      const profileDeletions = profileList.items.map(itemRef => {
        return deleteObject(itemRef);
      });
      await Promise.all(profileDeletions);
      console.log(`Deleted ${profileDeletions.length} profile images`);
    } catch (error) {
      // Ignore errors if the folder doesn't exist
      console.log('No profile images found or error deleting them:', error);
    }
    
    // Delete background images
    const backgroundImagesRef = ref(storage, `backgroundImages/${userId}`);
    try {
      const backgroundList = await listAll(backgroundImagesRef);
      const backgroundDeletions = backgroundList.items.map(itemRef => {
        return deleteObject(itemRef);
      });
      await Promise.all(backgroundDeletions);
      console.log(`Deleted ${backgroundDeletions.length} background images`);
    } catch (error) {
      // Ignore errors if the folder doesn't exist
      console.log('No background images found or error deleting them:', error);
    }
    
    console.log('Successfully deleted all user storage files');
  } catch (error) {
    console.error('Error deleting user storage files:', error);
    // Don't throw, to ensure account deletion continues even if storage cleanup fails
  }
}; 