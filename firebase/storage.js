import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from './config';
import * as FileSystem from 'expo-file-system';

// Initialize Firebase Storage
const storage = getStorage(app);

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