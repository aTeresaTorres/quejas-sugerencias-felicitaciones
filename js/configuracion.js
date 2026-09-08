// ============ VARIABLES GLOBALES ============
let dependenciasList = [];
let adminsList = [];
let confirmCallback = null;

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmailConfig').textContent = user.email;
        cargarConfiguracion();
        cargarDependencias();
        cargarAdministradores();
    } else {
        window.location.href = 'login.html';
    }
});

// ============ CERRAR SESIÓN ============
document.getElementById('btnLogoutConfig').addEventListener('click', () => {
    if (confirm('Seguro que quieres cerrar sesión?')) {
        auth.signOut();
    }
});

// ============ RECARGAR ============
document.getElementById('btnRecargarConfig').addEventListener('click', () => {
    cargarConfiguracion();
    cargarDependencias();
    cargarAdministradores();
});

// ============ NAVEGACIÓN POR TABS ============
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        
        const tabId = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + tabId).classList.add('active');
    });
});

// ============ CARGAR CONFIGURACIÓN ============
async function cargarConfiguracion() {
    try {
        const doc = await db.collection('configuracion').doc('general').get();
        
        if (doc.exists) {
            const data = doc.data();
            
            // General
            document.getElementById('nombreBuzon').value = data.nombreBuzon || '';
            document.getElementById('tituloAdmin').value = data.tituloAdmin || '';
            document.getElementById('descripcionBuzon').value = data.descripcionBuzon || '';
            
            // Contacto
            document.getElementById('emailContacto').value = data.emailContacto || '';
            document.getElementById('telefonoContacto').value = data.telefonoContacto || '';
            document.getElementById('horarioAtencion').value = data.horarioAtencion || '';
            document.getElementById('direccionContacto').value = data.direccionContacto || '';
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

// ============ GUARDAR CONFIGURACIÓN GENERAL ============
document.getElementById('formConfigGeneral').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    
    try {
        const data = {
            nombreBuzon: document.getElementById('nombreBuzon').value.trim(),
            tituloAdmin: document.getElementById('tituloAdmin').value.trim(),
            descripcionBuzon: document.getElementById('descripcionBuzon').value.trim(),
            actualizadoEn: new Date().toISOString(),
            actualizadoPor: auth.currentUser.email
        };
        
        await db.collection('configuracion').doc('general').set(data, { merge: true });
        
        mostrarExito('Configuración general guardada correctamente');
        
        // Actualizar título en el header
        if (data.tituloAdmin) {
            document.querySelector('.main-header-config h1').innerHTML = '<i class="fas fa-cog"></i> ' + data.tituloAdmin;
        }
        
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarError('Error al guardar la configuración', error.message);
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ============ GUARDAR CONFIGURACIÓN DE CONTACTO ============
document.getElementById('formConfigContacto').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    
    try {
        const data = {
            emailContacto: document.getElementById('emailContacto').value.trim(),
            telefonoContacto: document.getElementById('telefonoContacto').value.trim(),
            horarioAtencion: document.getElementById('horarioAtencion').value.trim(),
            direccionContacto: document.getElementById('direccionContacto').value.trim(),
            actualizadoEn: new Date().toISOString(),
            actualizadoPor: auth.currentUser.email
        };
        
        await db.collection('configuracion').doc('general').set(data, { merge: true });
        
        mostrarExito('Información de contacto guardada correctamente');
        
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarError('Error al guardar la información de contacto', error.message);
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ============ CARGAR DEPENDENCIAS ============
async function cargarDependencias() {
    const container = document.getElementById('dependenciasContainer');
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Cargando dependencias...</p>';
    
    try {
        const snapshot = await db.collection('dependencias').orderBy('nombre').get();
        dependenciasList = [];
        snapshot.forEach(doc => {
            dependenciasList.push({ id: doc.id, ...doc.data() });
        });
        
        renderDependencias();
    } catch (error) {
        console.error('Error al cargar dependencias:', error);
        container.innerHTML = '<p style="color: var(--danger); text-align: center; padding: 20px;">Error al cargar dependencias</p>';
    }
}

function renderDependencias() {
    const container = document.getElementById('dependenciasContainer');
    
    if (dependenciasList.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No hay dependencias registradas</p>';
        return;
    }
    
    let html = '';
    dependenciasList.forEach(dep => {
        const estadoClass = dep.activo !== false ? 'activo' : 'inactivo';
        const estadoLabel = dep.activo !== false ? 'Activa' : 'Inactiva';
        
        html += `
            <div class="dependencia-item">
                <div class="dep-info">
                    <span class="dep-nombre">${dep.nombre}</span>
                    <span class="dep-estado ${estadoClass}">${estadoLabel}</span>
                </div>
                <div class="dep-actions">
                    <button class="btn-edit" onclick="editarDependencia('${dep.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="eliminarDependencia('${dep.id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============ AGREGAR/EDITAR DEPENDENCIA ============
document.getElementById('btnAgregarDependencia').addEventListener('click', () => {
    document.getElementById('modalDepTitulo').textContent = 'Nueva dependencia';
    document.getElementById('depEditId').value = '';
    document.getElementById('depNombre').value = '';
    document.getElementById('depActivo').checked = true;
    document.getElementById('modalDependencia').style.display = 'block';
});

function editarDependencia(id) {
    const dep = dependenciasList.find(d => d.id === id);
    if (!dep) return;
    
    document.getElementById('modalDepTitulo').textContent = 'Editar dependencia';
    document.getElementById('depEditId').value = id;
    document.getElementById('depNombre').value = dep.nombre;
    document.getElementById('depActivo').checked = dep.activo !== false;
    document.getElementById('modalDependencia').style.display = 'block';
}

document.getElementById('formDependencia').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    
    const id = document.getElementById('depEditId').value;
    const nombre = document.getElementById('depNombre').value.trim();
    const activo = document.getElementById('depActivo').checked;
    
    if (!nombre) {
        mostrarError('Campo incompleto', 'El nombre de la dependencia es obligatorio');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    try {
        if (id) {
            // Editar
            await db.collection('dependencias').doc(id).update({
                nombre: nombre,
                activo: activo,
                actualizadoEn: new Date().toISOString(),
                actualizadoPor: auth.currentUser.email
            });
        } else {
            // Crear
            await db.collection('dependencias').add({
                nombre: nombre,
                activo: activo,
                creadoEn: new Date().toISOString(),
                creadoPor: auth.currentUser.email
            });
        }
        
        document.getElementById('modalDependencia').style.display = 'none';
        mostrarExito(id ? 'Dependencia actualizada' : 'Dependencia creada correctamente');
        cargarDependencias();
        
    } catch (error) {
        console.error('Error al guardar dependencia:', error);
        mostrarError('Error al guardar', error.message);
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ============ ELIMINAR DEPENDENCIA ============
function eliminarDependencia(id) {
    const dep = dependenciasList.find(d => d.id === id);
    if (!dep) return;
    
    mostrarConfirmacion(
        'Eliminar dependencia',
        'Estás a punto de eliminar la dependencia "' + dep.nombre + '". Esta acción no se puede deshacer.',
        async function() {
            try {
                await db.collection('dependencias').doc(id).delete();
                mostrarExito('Dependencia eliminada correctamente');
                cargarDependencias();
            } catch (error) {
                console.error('Error al eliminar:', error);
                mostrarError('Error al eliminar', error.message);
            }
        }
    );
}

// ============ CARGAR ADMINISTRADORES ============
async function cargarAdministradores() {
    const container = document.getElementById('administradoresList');
    container.innerHTML = '<p style="color: var(--text-muted); padding: 15px 0;">Cargando administradores...</p>';
    
    try {
        const snapshot = await db.collection('administradores').orderBy('email').get();
        adminsList = [];
        snapshot.forEach(doc => {
            adminsList.push({ id: doc.id, ...doc.data() });
        });
        
        renderAdministradores();
    } catch (error) {
        console.error('Error al cargar administradores:', error);
        container.innerHTML = '<p style="color: var(--text-muted); padding: 15px 0;">No se pudieron cargar los administradores</p>';
    }
}

function renderAdministradores() {
    const container = document.getElementById('administradoresList');
    const userActual = auth.currentUser;
    
    if (adminsList.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 15px 0;">No hay administradores registrados</p>';
        return;
    }
    
    let html = '';
    adminsList.forEach(admin => {
        const esActual = admin.email === userActual.email;
        html += `
            <div class="admin-item">
                <span class="admin-email ${esActual ? 'actual' : ''}">
                    ${esActual ? '<i class="fas fa-star"></i>' : '<i class="fas fa-user-check"></i>'}
                    ${admin.email}
                    ${esActual ? ' <span style="font-size: 0.7rem; color: var(--text-muted);">(tú)</span>' : ''}
                </span>
                ${!esActual ? `<button class="btn-remove-admin" onclick="eliminarAdministrador('${admin.id}')">Eliminar</button>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============ AGREGAR ADMINISTRADOR ============
document.getElementById('btnAgregarAdmin').addEventListener('click', async function() {
    const email = document.getElementById('emailNuevoAdmin').value.trim();
    
    if (!email) {
        mostrarError('Campo incompleto', 'Ingresa un correo electrónico');
        return;
    }
    
    if (!validarEmail(email)) {
        mostrarError('Email inválido', 'Ingresa un correo electrónico válido');
        return;
    }
    
    // Verificar si ya existe
    if (adminsList.some(a => a.email === email)) {
        mostrarError('Ya existe', 'Este usuario ya es administrador');
        return;
    }
    
    try {
        await db.collection('administradores').add({
            email: email,
            agregadoEn: new Date().toISOString(),
            agregadoPor: auth.currentUser.email
        });
        
        document.getElementById('emailNuevoAdmin').value = '';
        mostrarExito('Administrador agregado correctamente');
        cargarAdministradores();
        
    } catch (error) {
        console.error('Error al agregar administrador:', error);
        mostrarError('Error al agregar', error.message);
    }
});

// ============ ELIMINAR ADMINISTRADOR ============
function eliminarAdministrador(id) {
    const admin = adminsList.find(a => a.id === id);
    if (!admin) return;
    
    mostrarConfirmacion(
        'Eliminar administrador',
        'Estás a punto de eliminar al administrador "' + admin.email + '". Esta acción no se puede deshacer.',
        async function() {
            try {
                await db.collection('administradores').doc(id).delete();
                mostrarExito('Administrador eliminado correctamente');
                cargarAdministradores();
            } catch (error) {
                console.error('Error al eliminar:', error);
                mostrarError('Error al eliminar', error.message);
            }
        }
    );
}

// ============ CAMBIAR CONTRASEÑA ============
document.getElementById('btnCambiarPassword').addEventListener('click', () => {
    document.getElementById('modalCambiarPassword').style.display = 'block';
    document.getElementById('passActual').value = '';
    document.getElementById('passNueva').value = '';
    document.getElementById('passConfirmar').value = '';
});

document.getElementById('formCambiarPassword').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Cambiando...';
    btn.disabled = true;
    
    const actual = document.getElementById('passActual').value;
    const nueva = document.getElementById('passNueva').value;
    const confirmar = document.getElementById('passConfirmar').value;
    
    if (!actual || !nueva || !confirmar) {
        mostrarError('Campos incompletos', 'Todos los campos son obligatorios');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    if (nueva.length < 6) {
        mostrarError('Contraseña débil', 'La nueva contraseña debe tener al menos 6 caracteres');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    if (nueva !== confirmar) {
        mostrarError('Contraseñas no coinciden', 'Las contraseñas no coinciden');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    try {
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, actual);
        
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(nueva);
        
        document.getElementById('modalCambiarPassword').style.display = 'none';
        mostrarExito('Contraseña cambiada correctamente');
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        let mensaje = error.message;
        if (error.code === 'auth/wrong-password') {
            mensaje = 'La contraseña actual es incorrecta';
        } else if (error.code === 'auth/too-many-requests') {
            mensaje = 'Demasiados intentos fallidos. Espera unos minutos.';
        }
        mostrarError('Error al cambiar contraseña', mensaje);
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ============ LIMPIAR CACHÉ ============
document.getElementById('btnLimpiarCache').addEventListener('click', () => {
    mostrarConfirmacion(
        'Limpiar caché local',
        'Se eliminarán los datos almacenados localmente en tu navegador. ¿Continuar?',
        function() {
            try {
                localStorage.clear();
                sessionStorage.clear();
                if (window.indexedDB) {
                    indexedDB.databases().then(dbs => {
                        dbs.forEach(db => {
                            indexedDB.deleteDatabase(db.name);
                        });
                    }).catch(() => {});
                }
                mostrarExito('Caché local limpiada correctamente');
            } catch (error) {
                console.error('Error al limpiar caché:', error);
                mostrarError('Error al limpiar caché', error.message);
            }
        }
    );
});

// ============ FUNCIONES DE MODAL ============
// Cerrar modal de dependencia
document.getElementById('closeModalDep').addEventListener('click', () => {
    document.getElementById('modalDependencia').style.display = 'none';
});

// Cerrar modal de contraseña
document.getElementById('closeModalPass').addEventListener('click', () => {
    document.getElementById('modalCambiarPassword').style.display = 'none';
});

// Cerrar modales al hacer clic fuera
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Cerrar con Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        cerrarErrorConfig();
    }
});

// ============ ERROR MODAL ============
function mostrarError(titulo, mensaje) {
    const modal = document.getElementById('errorModalConfig');
    document.getElementById('errorTitleConfig').textContent = titulo || 'Error';
    document.getElementById('errorMessageConfig').textContent = mensaje || 'Ocurrió un error inesperado';
    modal.classList.add('show');
}

function cerrarErrorConfig() {
    document.getElementById('errorModalConfig').classList.remove('show');
}

// ============ CONFIRMACIÓN MODAL ============
function mostrarConfirmacion(titulo, mensaje, callback) {
    document.getElementById('confirmTitulo').textContent = titulo || 'Confirmar';
    document.getElementById('confirmMensaje').textContent = mensaje || '¿Estás seguro?';
    document.getElementById('modalConfirmacion').style.display = 'block';
    
    confirmCallback = callback || null;
}

document.getElementById('confirmSi').addEventListener('click', function() {
    document.getElementById('modalConfirmacion').style.display = 'none';
    if (typeof confirmCallback === 'function') {
        confirmCallback();
        confirmCallback = null;
    }
});

document.getElementById('confirmNo').addEventListener('click', function() {
    document.getElementById('modalConfirmacion').style.display = 'none';
    confirmCallback = null;
});

// ============ EXITO (TOAST) ============
function mostrarExito(mensaje) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 14px 24px;
        border-radius: var(--radius);
        font-weight: 600;
        font-size: 0.95rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 99999;
        animation: slideInModal 0.3s ease;
        max-width: 400px;
    `;
    toast.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 10px;"></i> ' + mensaje;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ============ VALIDACIÓN DE EMAIL ============
function validarEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

console.log('configuracion.js cargado correctamente');