// ============ LOGIN ============
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('mensajeError');
    
    // Ocultar error anterior
    errorDiv.style.display = 'none';
    
    if (!email || !password) {
        errorDiv.textContent = 'Por favor, completa todos los campos';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Usuario autenticado:', userCredential.user.email);
        window.location.href = 'admin.html';
    } catch (error) {
        console.error('Error de login:', error);
        
        let mensaje = 'Error al iniciar sesión. ';
        switch (error.code) {
            case 'auth/user-not-found':
                mensaje += 'Usuario no encontrado.';
                break;
            case 'auth/wrong-password':
                mensaje += 'Contraseña incorrecta.';
                break;
            case 'auth/invalid-email':
                mensaje += 'Correo electrónico inválido.';
                break;
            case 'auth/too-many-requests':
                mensaje += 'Demasiados intentos. Intenta más tarde.';
                break;
            default:
                mensaje += error.message;
        }
        
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
    }
});

// ============ VERIFICAR SESIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        // Si está en login.html y ya está autenticado, redirigir a admin
        if (window.location.pathname.includes('login.html') || window.location.pathname === '/' || window.location.pathname === '/index.html') {
            window.location.href = 'admin.html';
        }
    } else {
        // Si NO está autenticado y está en admin.html, redirigir a login
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'login.html';
        }
    }
});