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

// Configuración de Firestore
db.settings({ timestampsInSnapshots: true });

// Configurar persistencia de autenticación
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log('✅ Persistencia de auth configurada'))
    .catch((error) => console.error('❌ Error en persistencia:', error));

// Exportar para usar en otros archivos
console.log('✅ Servicios de Firebase inicializados:');
console.log('  📁 Firestore:', !!db);
console.log('  🔐 Auth:', !!auth);