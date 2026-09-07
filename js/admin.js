// ============ VARIABLES GLOBALES ============
let tickets = [];
let ticketActual = null;
let filtrosActuales = {};
let ticketsNuevos = new Set();

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmail').textContent = `👤 ${user.email}`;
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

// ============ RECARGAR CON FILTROS ACTUALES ============
document.getElementById('btnRecargar').addEventListener('click', () => {
    console.log('🔄 Recargando con filtros actuales:', filtrosActuales);
    cargarTickets(filtrosActuales);
});

// ============ BÚSQUEDA GLOBAL ============
document.getElementById('btnBuscar').addEventListener('click', () => {
    const termino = document.getElementById('busquedaGlobal').value.trim();
    if (termino) {
        filtrosActuales.terminoBusqueda = termino;
        cargarTickets(filtrosActuales);
    }
});

document.getElementById('busquedaGlobal').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btnBuscar').click();
    }
});

document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => {
    document.getElementById('busquedaGlobal').value = '';
    delete filtrosActuales.terminoBusqueda;
    cargarTickets(filtrosActuales);
});

// ============ FILTROS DE FECHA DINÁMICOS ============
document.getElementById('tipoFiltroFecha').addEventListener('change', function() {
    const container = document.getElementById('filtroFechaContainer');
    const tipo = this.value;
    
    let html = '';
    switch(tipo) {
        case 'anio':
            html = `
                <div class="form-group">
                    <label>Año</label>
                    <select id="filtroAnio">
                        ${generarOpcionesAnios()}
                    </select>
                </div>
            `;
            break;
        case 'mes':
            html = `
                <div class="form-group">
                    <label>Mes</label>
                    <input type="month" id="filtroMes">
                </div>
            `;
            break;
        case 'periodo':
            html = `
                <div class="form-group">
                    <label>Desde</label>
                    <input type="date" id="filtroDesde">
                </div>
                <div class="form-group">
                    <label>Hasta</label>
                    <input type="date" id="filtroHasta">
                </div>
            `;
            break;
        case 'dia':
            html = `
                <div class="form-group">
                    <label>Día específico</label>
                    <input type="date" id="filtroDia">
                </div>
            `;
            break;
        default:
            html = `<p style="color: #999; font-size: 0.9em;">Selecciona un tipo de filtro de fecha</p>`;
    }
    
    container.innerHTML = html;
});

function generarOpcionesAnios() {
    const anioActual = new Date().getFullYear();
    let options = '';
    for (let i = anioActual; i >= 2020; i--) {
        options += `<option value="${i}">${i}</option>`;
    }
    return options;
}

// ============ FUNCIÓN PARA OBTENER FECHA CORRECTA ============
function obtenerFechaCorrecta(fecha) {
    if (!fecha) return null;
    if (fecha.toDate) {
        return fecha.toDate();
    }
    if (typeof fecha === 'string') {
        return new Date(fecha);
    }
    if (fecha instanceof Date) {
        return fecha;
    }
    return null;
}

function normalizarFecha(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ============ CARGAR TICKETS CON FILTROS ============
async function cargarTickets(filtros = {}) {
    filtrosActuales = { ...filtros };
    
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '<p style="text-align: center;">⏳ Cargando tickets...</p>';
    
    try {
        if (typeof db === 'undefined') {
            container.innerHTML = '<p style="color: red;">❌ Error: Firebase no está inicializado</p>';
            return;
        }
        
        let query = db.collection('tickets').orderBy('fechaCreacion', 'desc');
        
        // Aplicar filtros básicos
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
        let ticketsTemp = [];
        const idsActuales = new Set();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            idsActuales.add(doc.id);
            
            let incluir = true;
            
            // Filtros de fecha (en cliente)
            incluir = aplicarFiltrosFecha(data, filtros);
            
            if (incluir) {
                ticketsTemp.push({ id: doc.id, ...data });
            }
        });
        
        // BÚSQUEDA GLOBAL
        if (filtros.terminoBusqueda) {
            const termino = filtros.terminoBusqueda.toLowerCase();
            ticketsTemp = ticketsTemp.filter(t => {
                const folio = (t.folio || '').toLowerCase();
                const nombre = (t.nombre || '').toLowerCase();
                const contacto = (t.contacto || '').toLowerCase();
                const email = (t.email || '').toLowerCase();
                const telefono = (t.telefono || '').toLowerCase();
                const mensaje = (t.mensaje || '').toLowerCase();
                
                return folio.includes(termino) || 
                       nombre.includes(termino) || 
                       contacto.includes(termino) ||
                       email.includes(termino) ||
                       telefono.includes(termino) ||
                       mensaje.includes(termino);
            });
        }
        
        // Detectar tickets NUEVOS (solo si estado es pendiente y no tiene historial)
        const idsNuevos = new Set();
        ticketsTemp.forEach(t => {
            // ✅ SOLO si estado es pendiente y no tiene historial
            const tieneHistorial = t.historialSeguimiento && t.historialSeguimiento.length > 0;
            const esPendiente = t.estado === 'pendiente';
            
            if (esPendiente && !tieneHistorial && !ticketsNuevos.has(t.id)) {
                idsNuevos.add(t.id);
            }
            ticketsNuevos.add(t.id);
        });
        
        tickets = ticketsTemp;
        renderTickets(tickets, idsNuevos);
        actualizarEstadisticas(tickets);
        
        document.getElementById('contadorTickets').textContent = `(${tickets.length} tickets)`;
        
    } catch (error) {
        console.error('Error al cargar tickets:', error);
        container.innerHTML = `
            <p style="color: red;">❌ Error al cargar los tickets</p>
            <p style="color: #666; font-size: 0.9em;">${error.message}</p>
        `;
    }
}

// ============ APLICAR FILTROS DE FECHA ============
function aplicarFiltrosFecha(data, filtros) {
    const tipoFecha = filtros.tipoFecha || 'ninguno';
    const tipoAccion = filtros.tipoAccion || 'cualquier';
    
    if (tipoFecha === 'ninguno') return true;
    
    let fechaComparar = null;
    let fechaObj = null;
    
    switch(tipoAccion) {
        case 'creacion':
            fechaObj = data.fechaCreacion;
            break;
        case 'actualizacion':
            fechaObj = data.fechaActualizacion;
            break;
        case 'envio_dependencia':
            fechaObj = data.fechaEnvioDependencia;
            break;
        case 'respuesta_dependencia':
            fechaObj = data.fechaRespuestaDependencia;
            break;
        case 'respuesta_ciudadano': {
            const respuestasCiudadano = data.respuestasCiudadano || [];
            if (respuestasCiudadano.length > 0) {
                const ultima = respuestasCiudadano[respuestasCiudadano.length - 1];
                fechaObj = ultima.fecha;
            }
            break;
        }
        case 'resolucion':
            fechaObj = data.fechaResolucion;
            break;
        default:
            fechaObj = data.fechaCreacion;
    }
    
    if (!fechaObj) return false;
    
    fechaComparar = obtenerFechaCorrecta(fechaObj);
    if (!fechaComparar) return false;
    
    const fecha = normalizarFecha(fechaComparar);
    
    switch(tipoFecha) {
        case 'anio': {
            const anio = parseInt(filtros.anio);
            if (!anio) return true;
            return fecha.getFullYear() === anio;
        }
        case 'mes': {
            if (!filtros.mes) return true;
            const [year, month] = filtros.mes.split('-').map(Number);
            return fecha.getFullYear() === year && fecha.getMonth() === month - 1;
        }
        case 'periodo': {
            let incluir = true;
            if (filtros.fechaInicio) {
                const inicio = normalizarFecha(new Date(filtros.fechaInicio));
                if (fecha < inicio) incluir = false;
            }
            if (filtros.fechaFin && incluir) {
                const fin = normalizarFecha(new Date(filtros.fechaFin));
                if (fecha > fin) incluir = false;
            }
            return incluir;
        }
        case 'dia': {
            if (!filtros.dia) return true;
            const dia = normalizarFecha(new Date(filtros.dia));
            return fecha.getTime() === dia.getTime();
        }
        default:
            return true;
    }
}

// ============ RENDERIZAR TICKETS ============
function renderTickets(tickets, idsNuevos = new Set()) {
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
        const fecha = obtenerFechaCorrecta(ticket.fechaCreacion) || new Date();
        const estadoClass = ticket.estado || 'pendiente';
        const estadoLabel = {
            'pendiente': '⏳ Pendiente',
            'en_revision': '🔍 En revisión',
            'en_proceso': '⚙️ En proceso',
            'vencido': '⏰ Vencido',
            'resuelto': '✅ Resuelto',
            'cerrado': '🔒 Cerrado'
        }[estadoClass] || estadoClass;
        
        const asuntoLabel = {
            'queja': '⚠️ Queja',
            'sugerencia': '💡 Sugerencia',
            'felicitacion': '🌟 Felicitación',
            'pendiente_clasificar': '⏳ Por clasificar',
            'no_procede': '🚫 No procede',
            'otros': '📌 Otros'
        }[ticket.asunto] || ticket.asunto;
        
        let contactoMostrar = ticket.contacto;
        if (ticket.email && ticket.telefono) {
            contactoMostrar = `${ticket.email} / ${ticket.telefono}`;
        } else if (ticket.email) {
            contactoMostrar = ticket.email;
        } else if (ticket.telefono) {
            contactoMostrar = ticket.telefono;
        }
        
        const dias = Math.floor((new Date() - fecha) / (1000 * 60 * 60 * 24));
        const diasLabel = dias === 0 ? 'Hoy' : `${dias}d`;
        
        // ✅ SOLO resaltar si es nuevo (pendiente y sin historial)
        const esNuevo = idsNuevos.has(ticket.id);
        const esPendiente = ticket.estado === 'pendiente';
        const tieneHistorial = ticket.historialSeguimiento && ticket.historialSeguimiento.length > 0;
        const debeResaltar = esNuevo && esPendiente && !tieneHistorial;
        
        html += `
            <tr class="${debeResaltar ? 'nuevo-ticket' : ''}" style="${debeResaltar ? 'background: #fff3cd; animation: highlightNew 3s ease;' : ''}">
                <td><strong>${debeResaltar ? '🆕 ' : ''}${ticket.folio}</strong></td>
                <td>${ticket.nombre}</td>
                <td>${contactoMostrar}</td>
                <td>${asuntoLabel}</td>
                <td>${ticket.dependencia || 'Sin asignar'}</td>
                <td><span class="estado ${estadoClass}">${estadoLabel}</span></td>
                <td>${fecha.toLocaleDateString('es-MX')}<br><small>${diasLabel}</small></td>
                <td>
                    <button onclick="verTicket('${ticket.id}')" class="btn-small">👁️ Ver</button>
                    <button onclick="irSeguimiento('${ticket.id}')" class="btn-small btn-success">📋 Seguimiento</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
    if (idsNuevos.size > 0) {
        setTimeout(() => {
            document.querySelectorAll('.nuevo-ticket').forEach(el => {
                el.style.background = '';
                el.style.animation = '';
            });
        }, 4000);
    }
}

// ============ VER TICKET ============
async function verTicket(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) {
        alert('Ticket no encontrado');
        return;
    }
    
    const modal = document.getElementById('modalVerTicket');
    const detalle = document.getElementById('detalleTicketVer');
    
    const fecha = obtenerFechaCorrecta(ticket.fechaCreacion) || new Date();
    const estadoLabel = {
        'pendiente': '⏳ Pendiente',
        'en_revision': '🔍 En revisión',
        'en_proceso': '⚙️ En proceso',
        'vencido': '⏰ Vencido',
        'resuelto': '✅ Resuelto',
        'cerrado': '🔒 Cerrado'
    }[ticket.estado] || ticket.estado;
    
    const asuntoLabel = {
        'queja': '⚠️ Queja',
        'sugerencia': '💡 Sugerencia',
        'felicitacion': '🌟 Felicitación',
        'pendiente_clasificar': '⏳ Por clasificar',
        'no_procede': '🚫 No procede',
        'otros': '📌 Otros'
    }[ticket.asunto] || ticket.asunto;
    
    let contactosHTML = '';
    if (ticket.email && ticket.telefono) {
        contactosHTML = `
            <div><strong>📧 Correo:</strong> ${ticket.email}</div>
            <div><strong>📞 Teléfono:</strong> ${ticket.telefono}</div>
        `;
    } else if (ticket.email) {
        contactosHTML = `<div><strong>📧 Correo:</strong> ${ticket.email}</div>`;
    } else if (ticket.telefono) {
        contactosHTML = `<div><strong>📞 Teléfono:</strong> ${ticket.telefono}</div>`;
    }
    
    let historialHTML = '';
    if (ticket.historialSeguimiento && ticket.historialSeguimiento.length > 0) {
        historialHTML = ticket.historialSeguimiento.map(h => {
            const fechaH = new Date(h.fecha);
            return `
                <div class="historial-item">
                    <p><strong>${h.accion}</strong> - ${fechaH.toLocaleString('es-MX')}</p>
                    ${h.descripcion ? `<p>${h.descripcion}</p>` : ''}
                    ${h.oficio ? `<p><strong>Oficio:</strong> ${h.oficio}</p>` : ''}
                    ${h.usuario ? `<p><small>Por: ${h.usuario}</small></p>` : ''}
                </div>
            `;
        }).join('');
    } else {
        historialHTML = '<p style="color: #999;">Sin historial de seguimiento</p>';
    }
    
    let respuestasHTML = '';
    if (ticket.respuestas && ticket.respuestas.length > 0) {
        respuestasHTML = ticket.respuestas.map(r => {
            const fechaR = new Date(r.fecha);
            return `
                <div class="respuesta-item">
                    <p><strong>${r.usuario}</strong> - ${fechaR.toLocaleString('es-MX')}</p>
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
        <h2>📋 Ticket ${ticket.folio}</h2>
        
        <div class="ticket-info">
            <div class="info-grid">
                <div><strong>👤 Nombre:</strong> ${ticket.nombre}</div>
                ${contactosHTML}
                <div><strong>📌 Asunto:</strong> <span style="font-weight: bold;">${asuntoLabel}</span></div>
                <div><strong>🏢 Dependencia:</strong> ${ticket.dependencia || 'Sin asignar'}</div>
                <div><strong>📊 Estado:</strong> <span class="estado ${ticket.estado}">${estadoLabel}</span></div>
                <div><strong>📅 Fecha creación:</strong> ${fecha.toLocaleString('es-MX')}</div>
                <div><strong>⏱️ Días transcurridos:</strong> ${Math.floor((new Date() - fecha) / (1000 * 60 * 60 * 24))} días</div>
            </div>
            
            <div class="mensaje-box">
                <strong>📝 Mensaje:</strong>
                <p>${ticket.mensaje}</p>
            </div>
        </div>
        
        <div class="historial">
            <h3>📜 Historial de seguimiento</h3>
            ${historialHTML}
        </div>
        
        <div class="respuestas">
            <h3>💬 Respuestas al usuario</h3>
            ${respuestasHTML}
        </div>
        
        <div style="margin-top: 20px; text-align: center;">
            <button onclick="cerrarModalVer()" style="background: #6c757d;">Cerrar</button>
            <button onclick="cerrarModalVer(); irSeguimiento('${ticket.id}')" class="btn-success">📋 Ir a seguimiento</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

function cerrarModalVer() {
    document.getElementById('modalVerTicket').style.display = 'none';
}

// ============ IR A SEGUIMIENTO ============
function irSeguimiento(id) {
    window.location.href = `seguimiento.html?id=${id}`;
}

// ============ ACTUALIZAR ESTADÍSTICAS ============
function actualizarEstadisticas(tickets) {
    const total = tickets.length;
    const pendientes = tickets.filter(t => t.estado === 'pendiente' || t.estado === 'en_revision').length;
    const enProceso = tickets.filter(t => t.estado === 'en_proceso').length;
    const vencidos = tickets.filter(t => t.estado === 'vencido').length;
    const resueltos = tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length;
    
    document.getElementById('totalTickets').textContent = total;
    document.getElementById('pendientes').textContent = pendientes;
    document.getElementById('enRevision').textContent = enProceso;
    document.getElementById('resueltos').textContent = resueltos;
    document.getElementById('vencidos').textContent = vencidos;
}

// ============ APLICAR FILTROS ============
document.getElementById('btnAplicarFiltros').addEventListener('click', () => {
    const filtros = {
        asunto: document.getElementById('filtroAsunto').value,
        estado: document.getElementById('filtroEstado').value,
        dependencia: document.getElementById('filtroDependencia').value,
        tipoFecha: document.getElementById('tipoFiltroFecha').value,
        tipoAccion: document.getElementById('filtroTipoAccion').value
    };
    
    const tipoFecha = filtros.tipoFecha;
    switch(tipoFecha) {
        case 'anio':
            filtros.anio = document.getElementById('filtroAnio')?.value;
            break;
        case 'mes':
            filtros.mes = document.getElementById('filtroMes')?.value;
            break;
        case 'periodo':
            filtros.fechaInicio = document.getElementById('filtroDesde')?.value;
            filtros.fechaFin = document.getElementById('filtroHasta')?.value;
            break;
        case 'dia':
            filtros.dia = document.getElementById('filtroDia')?.value;
            break;
        default:
            break;
    }
    
    Object.keys(filtros).forEach(key => {
        if (!filtros[key] || filtros[key] === 'ninguno') delete filtros[key];
    });
    
    const termino = document.getElementById('busquedaGlobal').value.trim();
    if (termino) {
        filtros.terminoBusqueda = termino;
    }
    
    cargarTickets(filtros);
});

// ============ LIMPIAR FILTROS ============
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('tipoFiltroFecha').value = 'ninguno';
    document.getElementById('filtroTipoAccion').value = 'cualquier';
    document.getElementById('filtroAsunto').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroDependencia').value = '';
    document.getElementById('busquedaGlobal').value = '';
    document.getElementById('filtroFechaContainer').innerHTML = '<p style="color: #999; font-size: 0.9em;">Selecciona un tipo de filtro de fecha</p>';
    
    filtrosActuales = {};
    cargarTickets();
});

// ============ CERRAR MODAL ============
window.onclick = function(event) {
    const modal = document.getElementById('modalVerTicket');
    if (event.target == modal) {
        cerrarModalVer();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarModalVer();
    }
});

console.log('✅ admin.js cargado correctamente');