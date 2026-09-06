// Configuración de Firebase (copia tus datos de Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyAG8PyBRLXPaCX3MQINy3c7qTAUg75a9lE",
  authDomain: "buzon-de-quejas-8b728.firebaseapp.com",
  projectId: "buzon-de-quejas-8b728",
  storageBucket: "buzon-de-quejas-8b728.firebasestorage.app",
  messagingSenderId: "602521052366",
  appId: "1:602521052366:web:ba28654eb6ca6bfe9e1c9f"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// ✅ IMPORTANTE: Verificar que Firebase esté inicializado antes de usar
console.log('🔥 Firebase inicializado:', firebase.app().name);

// Exportar para usar en otros archivos
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Configuración para timestamps
db.settings({ timestampsInSnapshots: true });

// Configuración de persistencia de sesión
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
