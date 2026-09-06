// ============ LOGIN MEJORADO CON DEPURACIÓN ============
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('mensajeError');
    
    // Resetear mensaje de error
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Validar campos vacíos
    if (!email || !password) {
        mostrarError('Por favor, completa todos los campos');
        return;
    }
    
    // Mostrar loading
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Verificando...';
    btn.disabled = true;
    
    try {
        console.log('Intentando login con:', email);
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login exitoso:', userCredential.user.email);
        
        // Redirigir al panel de administración
        window.location.href = 'admin.html';
        
    } catch (error) {
        console.error('❌ Error de login:', error.code, error.message);
        
        // Mensajes de error en español
        let mensaje = '';
        switch (error.code) {
            case 'auth/user-not-found':
                mensaje = '❌ Usuario no encontrado. Verifica tu correo electrónico.';
                break;
            case 'auth/wrong-password':
                mensaje = '❌ Contraseña incorrecta. Intenta de nuevo.';
                break;
            case 'auth/invalid-email':
                mensaje = '❌ Correo electrónico inválido.';
                break;
            case 'auth/too-many-requests':
                mensaje = '❌ Demasiados intentos fallidos. Espera unos minutos.';
                break;
            case 'auth/user-disabled':
                mensaje = '❌ Esta cuenta ha sido deshabilitada. Contacta al administrador.';
                break;
            case 'auth/network-request-failed':
                mensaje = '❌ Error de red. Verifica tu conexión a internet.';
                break;
            default:
                mensaje = `❌ Error: ${error.message}`;
        }
        
        mostrarError(mensaje);
        
    } finally {
        // Restaurar botón
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ============ MOSTRAR ERROR ============
function mostrarError(mensaje) {
    const errorDiv = document.getElementById('mensajeError');
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.padding = '12px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.border = '1px solid #f5c6cb';
    errorDiv.style.marginTop = '15px';
}

// ============ VERIFICAR SESIÓN CON DEPURACIÓN ============
auth.onAuthStateChanged(user => {
    console.log('🔍 Estado de autenticación:', user ? `Usuario ${user.email}` : 'No autenticado');
    
    if (user) {
        // Si está en login.html y ya está autenticado, redirigir a admin
        const currentPath = window.location.pathname;
        if (currentPath.includes('login.html') || currentPath === '/' || currentPath === '/index.html') {
            console.log('🔄 Redirigiendo a admin.html');
            window.location.href = 'admin.html';
        }
    } else {
        // Si NO está autenticado y está en admin.html, redirigir a login
        const currentPath = window.location.pathname;
        if (currentPath.includes('admin.html')) {
            console.log('🔄 Redirigiendo a login.html');
            window.location.href = 'login.html';
        }
    }
});
