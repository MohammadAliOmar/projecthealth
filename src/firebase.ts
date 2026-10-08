/**
 * Firebase Client SDK Initialization for ProjectHealth AI
 * 
 * If running in the AI Studio environment, the provisioned configuration
 * is loaded automatically from `firebase-applet-config.json`.
 * If deploying independently, replace the placeholders in the config object below.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// ============================================================================
// CONFIGURATION: Replace these placeholders if using your own Firebase project
// ============================================================================
export const fallbackFirebaseConfig = {
  apiKey: "AIzaSyCtzkILIX9u6DvT-uCH_oZFKf71_NdWwlU",
  authDomain: "projecthealth-ai.firebaseapp.com",
  projectId: "projecthealth-ai",
  storageBucket: "projecthealth-ai.firebasestorage.app",
  messagingSenderId: "993159425856",
  appId: "1:993159425856:web:66520937b7c02d68a914a5",
  firestoreDatabaseId: "(default)"
};

// Attempt to load the auto-provisioned configuration in this environment
let activeConfig = fallbackFirebaseConfig;

try {
  // Vite can import JSON files directly
  const configModule = await import('../firebase-applet-config.json');
  if (configModule && configModule.default && configModule.default.apiKey) {
    activeConfig = configModule.default;
  }
} catch {
  // Use fallback if the file is absent
}

// Initialize Firebase App instance singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore (supporting custom databaseId if provisioned)
const databaseId = (activeConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = (databaseId && databaseId !== '(default)') 
  ? getFirestore(app, databaseId) 
  : getFirestore(app);

// Connectivity validation constraint on boot
async function validateFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'status'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or network connection is restricted.");
    }
  }
}

validateFirestoreConnection();
