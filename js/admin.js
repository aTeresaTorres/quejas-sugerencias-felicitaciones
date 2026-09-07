// ============ VARIABLES GLOBALES ============
let tickets = [];
let ticketActual = null;
let unsubscribe = null;

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmail').textContent = `${user.email}`;
        cargarTickets();
    } else {
        window.location.href = 'login.html';
    }
});

// ============ CERRAR SESIÓN ============
document.getElementById('btnLogout').addEventListener('click', () => {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        auth.signOut();
    }
});

// ============ RECARGAR TICKETS ============
document.getElementById('btnRecargar').addEventListener('click', () => {
    cargarTickets();
});

// ============ CARGAR TICKETS CON FILTROS ============
async function cargarTickets(filtros = {}) {
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '<p style="text-align: center;">Cargando tickets...</p>';
    
    try {
        // Verificar que db existe
        if (typeof db === 'undefined') {
            console.error('db no está definido. ¿Firebase se inicializó correctamente?');
            container.innerHTML = '<p style="color: red;">Error: Firebase no está inicializado</p>';
            return;
        }
        
        let query = db.collection('tickets').orderBy('fechaCreacion', 'desc');
        
        // Aplicar filtros
        if (filtros.asunto && filtros.asunto !== '') {
            query = query.where('asunto', '==', filtros.asunto);
        }
        if (filtros.estado && filtros.estado !== '') {
            query = query.where('estado', '==', filtros.estado);
        }
        if (filtros.dependencia && filtros.dependencia !== '') {
            query = query.where('dependencia', '==', filtros.dependencia);
        }
        
        const snapshot = await query.get();
        tickets = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const fecha = data.fechaCreacion?.toDate?.() || new Date();
            
            // Filtrar por fecha en cliente
            let incluir = true;
            
            if (filtros.fechaInicio) {
                const inicio = new Date(filtros.fechaInicio);
                if (fecha < inicio) incluir = false;
            }
            if (filtros.fechaFin && incluir) {
                const fin = new Date(filtros.fechaFin);
                fin.setHours(23, 59, 59);
                if (fecha > fin) incluir = false;
            }
            
            if (incluir) {
                tickets.push({ id: doc.id, ...data });
            }
        });
        
        renderTickets(tickets);
        actualizarEstadisticas(tickets);
        
    } catch (error) {
        console.error('Error al cargar tickets:', error);
        console.error('Stack trace:', error.stack);
        container.innerHTML = `
            <p style="color: red;">Error al cargar los tickets</p>
            <p style="color: #666; font-size: 0.9em;">${error.message}</p>
        `;
    }
}

// ============ RENDERIZAR TICKETS ============
function renderTickets(tickets) {
    const container = document.getElementById('ticketsContainer');
    
    if (tickets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">📭 No hay tickets registrados con estos filtros</p>';
        return;
    }
    
    let html = '<div class="table-responsive"><table>';
    html += `
        <thead>
            <tr>
                <th>Folio</th>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Asunto</th>
                <th>Dependencia</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    tickets.forEach(ticket => {
        const fecha = ticket.fechaCreacion?.toDate?.() || new Date();
        const estadoClass = ticket.estado || 'pendiente';
        const estadoLabel = {
            'pendiente': 'Pendiente',
            'en_revision': 'En revisión',
            'resuelto': 'Resuelto',
            'cerrado': 'Cerrado'
        }[estadoClass] || estadoClass;
        
        // Mostrar asunto legible
        const asuntoLabel = {
            'queja': 'Queja',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'pendiente_clasificar': 'Por clasificar'
        }[ticket.asunto] || ticket.asunto;
        
        html += `
            <tr>
                <td><strong>${ticket.folio}</strong></td>
                <td>${ticket.nombre}</td>
                <td>${ticket.contacto}</td>
                <td>${asuntoLabel}</td>
                <td>${ticket.dependencia || 'Sin asignar'}</td>
                <td><span class="estado ${estadoClass}">${estadoLabel}</span></td>
                <td>${fecha.toLocaleDateString('es-MX')}</td>
                <td>
                    <button onclick="verTicket('${ticket.id}')" class="btn-small">👁️ Ver</button>
                    <button onclick="responderTicket('${ticket.id}')" class="btn-small btn-success">✉️ Responder</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ============ ACTUALIZAR ESTADÍSTICAS ============
function actualizarEstadisticas(tickets) {
    const total = tickets.length;
    const pendientes = tickets.filter(t => t.estado === 'pendiente').length;
    const enRevision = tickets.filter(t => t.estado === 'en_revision').length;
    const resueltos = tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length;
    
    document.getElementById('totalTickets').textContent = total;
    document.getElementById('pendientes').textContent = pendientes;
    document.getElementById('enRevision').textContent = enRevision;
    document.getElementById('resueltos').textContent = resueltos;
}

// ============ VER TICKET ============
async function verTicket(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) {
        alert('Ticket no encontrado');
        return;
    }
    
    ticketActual = ticket;
    const modal = document.getElementById('modalTicket');
    const detalle = document.getElementById('detalleTicket');
    
    const fecha = ticket.fechaCreacion?.toDate?.() || new Date();
    const estadoLabel = {
        'pendiente': 'Pendiente',
        'en_revision': 'En revisión',
        'resuelto': 'Resuelto',
        'cerrado': 'Cerrado'
    }[ticket.estado] || ticket.estado;
    
    // Mostrar ambos contactos si existen
    let contactosHTML = '';
    if (ticket.email && ticket.telefono) {
        contactosHTML = `
            <div><strong>Correo:</strong> ${ticket.email}</div>
            <div><strong>Teléfono:</strong> ${ticket.telefono}</div>
        `;
    } else if (ticket.email) {
        contactosHTML = `
            <div><strong>Correo:</strong> ${ticket.email}</div>
            <div style="color: #999;"><em>Teléfono no proporcionado</em></div>
        `;
    } else if (ticket.telefono) {
        contactosHTML = `
            <div style="color: #999;"><em>Correo no proporcionado</em></div>
            <div><strong>Teléfono:</strong> ${ticket.telefono}</div>
        `;
    }
    
    const asuntoLabel = {
        'queja': 'Queja',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación',
        'pendiente_clasificar': 'Pendiente de clasificar'
    }[ticket.asunto] || ticket.asunto;
    
    let respuestasHTML = '';
    if (ticket.respuestas && ticket.respuestas.length > 0) {
        respuestasHTML = ticket.respuestas.map(r => {
            const fechaResp = r.fecha?.toDate?.() || new Date(r.fecha);
            return `
                <div class="respuesta-item">
                    <p><strong>${r.usuario}</strong> - ${fechaResp.toLocaleString('es-MX')}</p>
                    <p>${r.descripcion}</p>
                    ${r.archivos && r.archivos.length > 0 ? 
                        r.archivos.map(url => `<a href="${url}" target="_blank" class="file-link">📎 Ver archivo</a>`).join(' ') : 
                        ''}
                </div>
            `;
        }).join('');
    } else {
        respuestasHTML = '<p style="color: #999;">Sin respuestas aún</p>';
    }
    
    detalle.innerHTML = `
        <h2>Ticket ${ticket.folio}</h2>
        
        <div class="ticket-info">
            <div class="info-grid">
                <div><strong>Nombre:</strong> ${ticket.nombre}</div>
                ${contactosHTML}
                <div><strong>Asunto:</strong> <span style="font-weight: bold;">${asuntoLabel}</span></div>
                <div><strong>Dependencia:</strong> ${ticket.dependencia || 'Sin asignar'}</div>
                <div><strong>Estado:</strong> <span class="estado ${ticket.estado}">${estadoLabel}</span></div>
                <div><strong>Fecha:</strong> ${fecha.toLocaleString('es-MX')}</div>
            </div>
            
            <div class="mensaje-box">
                <strong>Mensaje:</strong>
                <p>${ticket.mensaje}</p>
            </div>
        </div>
        
        <div class="respuestas">
            <h3>Respuestas</h3>
            ${respuestasHTML}
        </div>
        
        <div class="acciones-ticket">
            <h3>Acciones</h3>
            
            <div class="form-group">
                <label>Clasificar asunto:</label>
                <select id="asignarAsunto">
                    <option value="queja" ${ticket.asunto === 'queja' ? 'selected' : ''}>Queja</option>
                    <option value="sugerencia" ${ticket.asunto === 'sugerencia' ? 'selected' : ''}>Sugerencia</option>
                    <option value="felicitacion" ${ticket.asunto === 'felicitacion' ? 'selected' : ''}>Felicitación</option>
                    <option value="pendiente_clasificar" ${ticket.asunto === 'pendiente_clasificar' ? 'selected' : ''}>Pendiente de clasificar</option>
                </select>
                <button onclick="asignarAsunto('${ticket.id}')" class="btn-success">Clasificar</button>
            </div>
            
            <div class="form-group">
                <label>Cambiar estado:</label>
                <select id="cambiarEstado">
                    <option value="pendiente" ${ticket.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="en_revision" ${ticket.estado === 'en_revision' ? 'selected' : ''}>En revisión</option>
                    <option value="resuelto" ${ticket.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                    <option value="cerrado" ${ticket.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                </select>
                <button onclick="actualizarEstado('${ticket.id}')" class="btn-success">Actualizar estado</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// ============ ASIGNAR ASUNTO ============
async function asignarAsunto(id) {
    const nuevoAsunto = document.getElementById('asignarAsunto').value;
    
    if (!confirm(`¿Clasificar este asunto como "${nuevoAsunto}"?`)) return;
    
    try {
        await db.collection('tickets').doc(id).update({
            asunto: nuevoAsunto,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Asunto clasificado correctamente');
        cerrarModal();
        cargarTickets();
        
    } catch (error) {
        console.error('Error al clasificar asunto:', error);
        alert('Error al clasificar el asunto: ' + error.message);
    }
}

// ============ ACTUALIZAR ESTADO ============
async function actualizarEstado(id) {
    const nuevoEstado = document.getElementById('cambiarEstado').value;
    
    if (!confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return;
    
    try {
        await db.collection('tickets').doc(id).update({
            estado: nuevoEstado,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Estado actualizado correctamente');
        cerrarModal();
        cargarTickets();
        
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        alert('Error al actualizar el estado: ' + error.message);
    }
}

// ============ RESPONDER TICKET ============
function responderTicket(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    
    const modal = document.getElementById('modalTicket');
    const detalle = document.getElementById('detalleTicket');
    
    detalle.innerHTML = `
        <h2>Responder ticket ${ticket.folio}</h2>
        <p><strong>Para:</strong> ${ticket.nombre} (${ticket.contacto})</p>
        
        <div class="form-responder">
            <div class="form-group">
                <label>Descripción de la respuesta *</label>
                <textarea id="respuestaTexto" rows="4" placeholder="Escribe tu respuesta aquí..." required></textarea>
            </div>
            <div class="form-group">
                <label>📎 Subir evidencia (archivos)</label>
                <input type="file" id="archivosRespuesta" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt">
                <small>Puedes subir múltiples archivos (PDF, imágenes, documentos)</small>
                <div id="listaArchivos" style="margin-top: 10px;"></div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="guardarRespuesta('${ticket.id}')" class="btn-success" style="flex: 1;">Enviar respuesta</button>
                <button onclick="cerrarModal()" style="flex: 0.5; background: #6c757d;">Cancelar</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Mostrar archivos seleccionados
    document.getElementById('archivosRespuesta').addEventListener('change', function(e) {
        const lista = document.getElementById('listaArchivos');
        lista.innerHTML = '';
        for (let file of this.files) {
            const div = document.createElement('div');
            div.textContent = `${file.name} (${(file.size/1024).toFixed(1)} KB)`;
            div.style.cssText = 'padding: 5px; background: #f1f1f1; margin: 3px 0; border-radius: 3px;';
            lista.appendChild(div);
        }
    });
}

// ============ GUARDAR RESPUESTA ============
async function guardarRespuesta(id) {
    const texto = document.getElementById('respuestaTexto').value.trim();
    const archivosInput = document.getElementById('archivosRespuesta');
    
    if (!texto) {
        alert('Por favor, escribe una descripción para la respuesta');
        return;
    }
    
    const btn = document.querySelector('[onclick^="guardarRespuesta"]');
    btn.textContent = 'Enviando...';
    btn.disabled = true;
    
    try {
        const user = auth.currentUser;
        const archivosURLs = [];
        
        // Subir archivos si existen
        if (archivosInput.files.length > 0) {
            for (let file of archivosInput.files) {
                const path = `respuestas/${id}/${Date.now()}_${file.name}`;
                const storageRef = storage.ref(path);
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                archivosURLs.push(url);
            }
        }
        
        // Guardar respuesta en Firestore
        const ticketRef = db.collection('tickets').doc(id);
        await ticketRef.update({
            respuestas: firebase.firestore.FieldValue.arrayUnion({
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                descripcion: texto,
                archivos: archivosURLs,
                usuario: user.email
            }),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
            estado: 'en_revision'
        });
        
        alert('Respuesta guardada correctamente');
        cerrarModal();
        cargarTickets();
        
    } catch (error) {
        console.error('Error al guardar respuesta:', error);
        alert('Error al guardar la respuesta: ' + error.message);
    } finally {
        btn.textContent = 'Enviar respuesta';
        btn.disabled = false;
    }
}

// ============ CERRAR MODAL ============
function cerrarModal() {
    document.getElementById('modalTicket').style.display = 'none';
}

// ============ APLICAR FILTROS ============
document.getElementById('btnAplicarFiltros').addEventListener('click', () => {
    console.log('Aplicando filtros...');
    
    const filtros = {
        asunto: document.getElementById('filtroAsunto').value,
        estado: document.getElementById('filtroEstado').value,
        dependencia: document.getElementById('filtroDependencia').value,
        fechaInicio: document.getElementById('filtroDesde').value,
        fechaFin: document.getElementById('filtroHasta').value
    };
    
    // Filtrar por mes si se especificó
    const mes = document.getElementById('filtroMes').value;
    if (mes) {
        const [year, month] = mes.split('-');
        const inicio = new Date(year, month - 1, 1);
        const fin = new Date(year, month, 0);
        filtros.fechaInicio = inicio.toISOString().split('T')[0];
        filtros.fechaFin = fin.toISOString().split('T')[0];
    }
    
    console.log('Filtros aplicados:', filtros);
    cargarTickets(filtros);
});

// ============ LIMPIAR FILTROS ============
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('filtroMes').value = '';
    document.getElementById('filtroDesde').value = '';
    document.getElementById('filtroHasta').value = '';
    document.getElementById('filtroAsunto').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroDependencia').value = '';
    
    cargarTickets();
});

// ============ CERRAR MODAL AL HACER CLICK FUERA ============
window.onclick = function(event) {
    const modal = document.getElementById('modalTicket');
    if (event.target == modal) {
        cerrarModal();
    }
}

// ============ TECLA ESC PARA CERRAR MODAL ============
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarModal();
    }
});

console.log('admin.js cargado completamente');