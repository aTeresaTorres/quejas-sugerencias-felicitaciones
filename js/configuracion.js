// ============ VARIABLES GLOBALES ============
let dependenciasList = [];
let confirmCallback = null;

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmailConfig').textContent = user.email;
        cargarConfiguracion();
        cargarDependencias();
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

// ============ FUNCIONES DE CONTACTOS MÚLTIPLES ============
function agregarContacto(containerId, claseInput, placeholder) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.innerHTML = `
        <input type="${claseInput === 'email-contacto' ? 'email' : 'tel'}" 
               class="${claseInput}" 
               placeholder="${placeholder}">
        <button type="button" class="btn-remove-contact" onclick="removerContacto(this, '${containerId}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function removerContacto(btn, containerId) {
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll('.contact-item');
    if (items.length <= 1) {
        mostrarError('No se puede eliminar', 'Debe haber al menos un contacto en esta sección');
        return;
    }
    btn.closest('.contact-item').remove();
}

function obtenerValoresContactos(containerId, claseInput) {
    const container = document.getElementById(containerId);
    const inputs = container.querySelectorAll('.' + claseInput);
    const valores = [];
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) valores.push(val);
    });
    return valores;
}

function cargarValoresContactos(containerId, claseInput, valores) {
    const container = document.getElementById(containerId);
    // Limpiar excepto el primero
    const items = container.querySelectorAll('.contact-item');
    if (items.length > 1) {
        items.forEach((item, index) => {
            if (index > 0) item.remove();
        });
    }
    
    // Cargar valores
    const primerInput = container.querySelector('.' + claseInput);
    if (primerInput) {
        primerInput.value = valores && valores.length > 0 ? valores[0] : '';
    }
    
    // Agregar los demás
    if (valores && valores.length > 1) {
        for (let i = 1; i < valores.length; i++) {
            const div = document.createElement('div');
            div.className = 'contact-item';
            const tipo = claseInput === 'email-contacto' ? 'email' : 'tel';
            const placeholder = claseInput === 'email-contacto' ? 'Correo electrónico' : 'Teléfono';
            div.innerHTML = `
                <input type="${tipo}" class="${claseInput}" value="${valores[i]}" placeholder="${placeholder}">
                <button type="button" class="btn-remove-contact" onclick="removerContacto(this, '${containerId}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        }
    }
}

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
            
            // Contacto - Múltiples correos y teléfonos
            const emails = data.emailsContacto || (data.emailContacto ? [data.emailContacto] : ['']);
            const telefonos = data.telefonosContacto || (data.telefonoContacto ? [data.telefonoContacto] : ['']);
            
            cargarValoresContactos('emailsContainer', 'email-contacto', emails);
            cargarValoresContactos('telefonosContainer', 'telefono-contacto', telefonos);
            
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
        // Obtener todos los correos y teléfonos
        const emails = obtenerValoresContactos('emailsContainer', 'email-contacto');
        const telefonos = obtenerValoresContactos('telefonosContainer', 'telefono-contacto');
        
        if (emails.length === 0) {
            mostrarError('Campo incompleto', 'Debe haber al menos un correo de contacto');
            btn.textContent = textoOriginal;
            btn.disabled = false;
            return;
        }
        
        if (telefonos.length === 0) {
            mostrarError('Campo incompleto', 'Debe haber al menos un teléfono de contacto');
            btn.textContent = textoOriginal;
            btn.disabled = false;
            return;
        }
        
        // Validar emails
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        for (const email of emails) {
            if (!emailRegex.test(email)) {
                mostrarError('Email inválido', `"${email}" no es un correo válido`);
                btn.textContent = textoOriginal;
                btn.disabled = false;
                return;
            }
        }
        
        const data = {
            emailsContacto: emails,
            telefonosContacto: telefonos,
            // Mantener compatibilidad con versiones anteriores
            emailContacto: emails[0] || '',
            telefonoContacto: telefonos[0] || '',
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

// ============ FUNCIONES DE MODAL ============
document.getElementById('closeModalDep').addEventListener('click', () => {
    document.getElementById('modalDependencia').style.display = 'none';
});

window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

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

console.log('configuracion.js cargado correctamente');