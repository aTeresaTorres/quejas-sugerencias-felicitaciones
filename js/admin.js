// ============ VARIABLES GLOBALES ============
let tickets = [];
let ticketActual = null;
let filtrosActuales = {};
let ticketsNuevos = new Set();

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmailText').textContent = user.email;
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
    switch (tipo) {
        case 'anio':
            html = `
                <div class="filtro-grupo">
                    <label>Año</label>
                    <select id="filtroAnio">${generarOpcionesAnios()}</select>
                </div>
            `;
            break;
        case 'mes':
            html = `
                <div class="filtro-grupo">
                    <label>Mes</label>
                    <input type="month" id="filtroMes" max="${fechaHoyLocal().slice(0, 7)}">
                </div>
            `;
            break;
        case 'periodo':
            html = `
                <div class="filtro-grupo">
                    <label>Desde</label>
                    <input type="date" id="filtroDesde" max="${fechaHoyLocal()}">
                </div>
                <div class="filtro-grupo">
                    <label>Hasta</label>
                    <input type="date" id="filtroHasta" max="${fechaHoyLocal()}">
                </div>
            `;
            break;
        case 'dia':
            html = `
                <div class="filtro-grupo">
                    <label>Día específico</label>
                    <input type="date" id="filtroDia" max="${fechaHoyLocal()}">
                </div>
            `;
            break;
        default:
            html = `<p style="color: #999; font-size: 0.85em; padding: 5px 0;">Selecciona un tipo de filtro de fecha</p>`;
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

// ============ FUNCIONES DE FECHA ============

// Devuelve la fecha de "hoy" en horario LOCAL como string YYYY-MM-DD.
// OJO: usar new Date().toISOString() da la fecha en UTC, lo cual puede
// adelantar o atrasar un día completo en husos horarios como el de México.
function fechaHoyLocal() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Convierte cualquier fecha (Timestamp de Firestore, string, Date) a un objeto Date.
// Si la fecha viene como "YYYY-MM-DD" (fecha sin hora, como las de <input type="date">)
// se interpreta en horario LOCAL, no en UTC, para evitar que se recorra un día.
function parseFechaLocal(fecha) {
    if (!fecha) return null;
    if (fecha.toDate) return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return new Date(fecha + 'T00:00:00');
        }
        return new Date(fecha);
    }
    return null;
}

function obtenerFechaCorrecta(fecha) {
    if (!fecha) return null;
    if (fecha.toDate) return fecha.toDate();
    if (typeof fecha === 'string') return new Date(fecha);
    if (fecha instanceof Date) return fecha;
    return null;
}

function normalizarFecha(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX');
}

function formatearFechaHora(fecha) {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return d.toLocaleString('es-MX');
}

function formatearFechaSinHora(fecha) {
    if (!fecha) return 'N/A';
    const d = parseFechaLocal(fecha) || new Date(fecha);
    return d.toLocaleDateString('es-MX');
}

// ============ CALCULAR DÍAS HÁBILES ============
// Cuenta los días hábiles ENTRE fechaInicio (exclusiva) y fechaFin (inclusiva),
// saltando sábados, domingos y días festivos.
function calcularDiasHabiles(fechaInicio, fechaFin) {
    const inicio = parseFechaLocal(fechaInicio);
    const fin = parseFechaLocal(fechaFin);
    if (!inicio || !fin) return null;

    let count = 0;
    const current = new Date(inicio);
    current.setHours(0, 0, 0, 0);
    const end = new Date(fin);
    end.setHours(0, 0, 0, 0);

    if (current >= end) {
        return 0;
    }

    const diasFestivos = [
        '2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01',
        '2026-09-16', '2026-11-16', '2026-12-25'
    ];

    current.setDate(current.getDate() + 1);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !diasFestivos.includes(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// ============ OBTENER FECHA DE RECIBIDO DEL PRIMER ENVÍO ============
// IMPORTANTE: el "primer envío" es SIEMPRE envios[0] (el que se registra en el Paso 5).
// Los envíos adicionales (Paso 6) se agregan después en el arreglo y NUNCA deben
// usarse para este cálculo, aunque tengan fecha de recibido y el primero todavía no.
function obtenerFechaRecibidoPrimerEnvio(ticket) {
    const envios = ticket.enviosDependencia || [];
    if (envios.length === 0) return null;
    return envios[0].fechaRecibido || null;
}

// ============ OBTENER FECHA DE RESPUESTA AL CIUDADANO ============
function obtenerFechaRespuestaCiudadano(ticket) {
    const respuestas = ticket.respuestasCiudadano || [];
    if (respuestas.length > 0) {
        const ultima = respuestas[respuestas.length - 1];
        return ultima.fechaRespuesta || ultima.fecha;
    }
    return null;
}

// ============ CARGAR TICKETS ============
async function cargarTickets(filtros = {}) {
    filtrosActuales = { ...filtros };

    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando tickets...</p>';

    try {
        if (typeof db === 'undefined') {
            container.innerHTML = '<p style="color: red;">Error: Firebase no está inicializado</p>';
            return;
        }

        let query = db.collection('tickets').orderBy('fechaCreacion', 'desc');

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

        snapshot.forEach(doc => {
            const data = doc.data();

            // Se aplica SIEMPRE que haya un tipo de filtro de fecha seleccionado,
            // incluyendo "cualquier acción" (antes esto se saltaba por completo).
            const incluir = aplicarFiltrosFecha(data, filtros);

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

                return folio.includes(termino) || nombre.includes(termino) ||
                    contacto.includes(termino) || email.includes(termino) ||
                    telefono.includes(termino) || mensaje.includes(termino);
            });
        }

        // Detectar tickets NUEVOS (pendientes sin historial)
        const idsNuevos = new Set();
        ticketsTemp.forEach(t => {
            const esPendiente = t.estado === 'pendiente';
            const tieneHistorial = t.historialSeguimiento && t.historialSeguimiento.length > 0;
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
            <p style="color: red;">Error al cargar los tickets</p>
            <p style="color: #666; font-size: 0.9em;">${error.message}</p>
        `;
    }
}

// ============ OBTENER TODAS LAS FECHAS RELEVANTES DE UN TICKET ============
// Devuelve un objeto { accion: Date } con la fecha representativa de cada
// posible acción del ticket. Se usa tanto para filtrar por una acción
// específica como para filtrar por "cualquier acción".
function obtenerFechasPorAccion(data) {
    const fechas = {};

    if (data.fechaCreacion) {
        fechas.creacion = obtenerFechaCorrecta(data.fechaCreacion);
    }
    if (data.fechaActualizacion) {
        fechas.actualizacion = obtenerFechaCorrecta(data.fechaActualizacion);
    }

    const envios = data.enviosDependencia || [];
    if (envios.length > 0) {
        // El envío a dependencia (Paso 5) es SIEMPRE el primero del arreglo
        const principal = envios[0];
        const fechaEnvio = principal.fechaRecibido || principal.fecha;
        if (fechaEnvio) {
            fechas.envio_dependencia = principal.fechaRecibido
                ? parseFechaLocal(fechaEnvio)
                : obtenerFechaCorrecta(fechaEnvio);
        }
    }

    const respDep = data.respuestasDependencia || [];
    if (respDep.length > 0) {
        const ultima = respDep[respDep.length - 1];
        const f = ultima.fechaRespuesta || ultima.fecha;
        if (f) {
            fechas.respuesta_dependencia = ultima.fechaRespuesta
                ? parseFechaLocal(f)
                : obtenerFechaCorrecta(f);
        }
    }

    const respCiu = data.respuestasCiudadano || [];
    if (respCiu.length > 0) {
        const ultima = respCiu[respCiu.length - 1];
        const f = ultima.fechaRespuesta || ultima.fecha;
        if (f) {
            fechas.respuesta_ciudadano = ultima.fechaRespuesta
                ? parseFechaLocal(f)
                : obtenerFechaCorrecta(f);
        }
    }

    if (data.fechaResolucion) {
        fechas.resolucion = obtenerFechaCorrecta(data.fechaResolucion);
    }

    return fechas;
}

// ============ EVALUAR SI UNA FECHA CUMPLE EL CRITERIO DEL FILTRO ============
function coincideConFiltroFecha(fechaObj, tipoFecha, filtros) {
    if (!fechaObj) return false;
    const fecha = normalizarFecha(fechaObj);

    switch (tipoFecha) {
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
                const inicio = normalizarFecha(parseFechaLocal(filtros.fechaInicio));
                if (fecha < inicio) incluir = false;
            }
            if (filtros.fechaFin && incluir) {
                const fin = normalizarFecha(parseFechaLocal(filtros.fechaFin));
                if (fecha > fin) incluir = false;
            }
            return incluir;
        }
        case 'dia': {
            if (!filtros.dia) return true;
            const dia = normalizarFecha(parseFechaLocal(filtros.dia));
            return fecha.getTime() === dia.getTime();
        }
        default:
            return true;
    }
}

// ============ APLICAR FILTROS DE FECHA ============
// Si tipoAccion === 'cualquier', el ticket se incluye si CUALQUIERA de sus
// fechas registradas (creación, actualización, envío, respuestas, resolución)
// cae dentro del criterio de fecha seleccionado. Antes, "cualquier acción"
// simplemente ignoraba el filtro de fecha por completo; ahora sí filtra.
function aplicarFiltrosFecha(data, filtros) {
    const tipoFecha = filtros.tipoFecha || 'ninguno';
    if (tipoFecha === 'ninguno') return true;

    const tipoAccion = filtros.tipoAccion || 'cualquier';
    const fechasPorAccion = obtenerFechasPorAccion(data);

    if (tipoAccion === 'cualquier') {
        return Object.values(fechasPorAccion).some(f => coincideConFiltroFecha(f, tipoFecha, filtros));
    }

    const fechaObj = fechasPorAccion[tipoAccion];
    return coincideConFiltroFecha(fechaObj, tipoFecha, filtros);
}

// ============ RENDERIZAR TICKETS ============
function renderTickets(tickets, idsNuevos = new Set()) {
    const container = document.getElementById('ticketsContainer');

    if (tickets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No hay tickets registrados con estos filtros</p>';
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
            'pendiente': 'Pendiente',
            'en_revision': 'En revisión',
            'en_proceso': 'En proceso',
            'vencido': 'Vencido',
            'resuelto': 'Resuelto',
            'cerrado': 'Cerrado'
        }[estadoClass] || estadoClass;

        const asuntoLabel = {
            'queja': 'Queja',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'pendiente_clasificar': 'Por clasificar',
            'no_procede': 'No procede',
            'otros': 'Otros'
        }[ticket.asunto] || ticket.asunto;

        let contactoMostrar = ticket.contacto;
        if (ticket.email && ticket.telefono) {
            contactoMostrar = ticket.email + ' / ' + ticket.telefono;
        } else if (ticket.email) {
            contactoMostrar = ticket.email;
        } else if (ticket.telefono) {
            contactoMostrar = ticket.telefono;
        }

        const esPendiente = ticket.estado === 'pendiente';
        const tieneHistorial = ticket.historialSeguimiento && ticket.historialSeguimiento.length > 0;
        const debeResaltar = esPendiente && !tieneHistorial;

        html += `
            <tr class="${debeResaltar ? 'nuevo-ticket' : ''}">
                <td><strong>${ticket.folio}</strong></td>
                <td>${ticket.nombre}</td>
                <td>${contactoMostrar}</td>
                <td>${asuntoLabel}</td>
                <td>${ticket.dependencia || 'Sin asignar'}</td>
                <td><span class="estado ${estadoClass}">${estadoLabel}</span></td>
                <td>${formatearFecha(fecha)}</td>
                <td>
                    <button onclick="verTicket('${ticket.id}')" class="btn-small"><i class="fas fa-eye"></i> Ver</button>
                    <button onclick="irSeguimiento('${ticket.id}')" class="btn-small btn-success"><i class="fas fa-arrow-right"></i> Seguimiento</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
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
        'pendiente': 'Pendiente',
        'en_revision': 'En revisión',
        'en_proceso': 'En proceso',
        'vencido': 'Vencido',
        'resuelto': 'Resuelto',
        'cerrado': 'Cerrado'
    }[ticket.estado] || ticket.estado;

    const asuntoLabel = {
        'queja': 'Queja',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación',
        'pendiente_clasificar': 'Por clasificar',
        'no_procede': 'No procede',
        'otros': 'Otros'
    }[ticket.asunto] || ticket.asunto;

    let contactosHTML = '';
    if (ticket.email && ticket.telefono) {
        contactosHTML = `
            <div><i class="fas fa-envelope"></i> <strong>Correo:</strong> ${ticket.email}</div>
            <div><i class="fas fa-phone"></i> <strong>Teléfono:</strong> ${ticket.telefono}</div>
        `;
    } else if (ticket.email) {
        contactosHTML = `<div><i class="fas fa-envelope"></i> <strong>Correo:</strong> ${ticket.email}</div>`;
    } else if (ticket.telefono) {
        contactosHTML = `<div><i class="fas fa-phone"></i> <strong>Teléfono:</strong> ${ticket.telefono}</div>`;
    }

    // ============ CALCULAR DÍAS HÁBILES ============
    // Desde la fecha de recibido del PRIMER envío a dependencia hasta la fecha
    // de respuesta al ciudadano (o hasta hoy si todavía no se ha respondido).
    let diasHabiles = null;
    let diasHabilesLabel = 'No disponible';

    const fechaRecibido = obtenerFechaRecibidoPrimerEnvio(ticket);
    const fechaRespuesta = obtenerFechaRespuestaCiudadano(ticket);

    if (fechaRecibido) {
        if (fechaRespuesta) {
            diasHabiles = calcularDiasHabiles(fechaRecibido, fechaRespuesta);
            diasHabilesLabel = diasHabiles !== null ? diasHabiles + ' días hábiles' : 'No disponible';
        } else {
            diasHabiles = calcularDiasHabiles(fechaRecibido, fechaHoyLocal());
            diasHabilesLabel = diasHabiles !== null ? diasHabiles + ' días hábiles (en proceso)' : 'No disponible';
        }
    }

    // ============ HISTORIAL SIMPLIFICADO ============
    let historialHTML = '';
    if (ticket.historialSeguimiento && ticket.historialSeguimiento.length > 0) {
        historialHTML = ticket.historialSeguimiento.map(h => {
            const fechaH = new Date(h.fecha);
            return `
                <div class="historial-item">
                    <p><strong><i class="fas fa-tag"></i> ${h.accion}</strong></p>
                    <p><i class="fas fa-clock"></i> <strong>Fecha de registro:</strong> ${formatearFechaHora(fechaH)}</p>
                    <p><i class="fas fa-user"></i> <strong>Por:</strong> ${h.usuario || 'N/A'}</p>
                </div>
            `;
        }).join('');
    } else {
        historialHTML = '<p style="color: #999;">Sin historial de seguimiento</p>';
    }

    // ============ RESPUESTAS AL CIUDADANO ============
    let respuestasHTML = '';
    if (ticket.respuestasCiudadano && ticket.respuestasCiudadano.length > 0) {
        respuestasHTML = ticket.respuestasCiudadano.map(r => {
            const fechaR = new Date(r.fecha);
            // La fecha de respuesta NUNCA lleva hora: el usuario solo captura el día.
            const fechaResp = r.fechaRespuesta ? r.fechaRespuesta : null;
            return `
                <div class="respuesta-item">
                    <p><strong>Descripción:</strong> ${r.descripcion}</p>
                    <p><i class="fas fa-calendar-check"></i> <strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFechaSinHora(fechaResp) : 'N/A'}</p>
                    <hr style="border: none; border-top: 1px dashed #ddd; margin: 8px 0;">
                    <p style="font-size: 0.85rem; color: #666;">
                        <i class="fas fa-clock"></i> <strong>Registrado:</strong> ${formatearFechaHora(fechaR)}
                    </p>
                    <p style="font-size: 0.85rem; color: #666;">
                        <i class="fas fa-user"></i> <strong>Por:</strong> ${r.usuario || 'N/A'}
                    </p>
                </div>
            `;
        }).join('');
    } else {
        respuestasHTML = '<p style="color: #999;">Sin respuestas al ciudadano</p>';
    }

    detalle.innerHTML = `
        <h2><i class="fas fa-ticket-alt"></i> Ticket ${ticket.folio}</h2>
        
        <div class="ticket-info">
            <div class="info-grid">
                <div><i class="fas fa-user"></i> <strong>Nombre:</strong> ${ticket.nombre}</div>
                ${contactosHTML}
                <div><i class="fas fa-tag"></i> <strong>Asunto:</strong> <span style="font-weight: bold;">${asuntoLabel}</span></div>
                <div><i class="fas fa-building"></i> <strong>Dependencia:</strong> ${ticket.dependencia || 'Sin asignar'}</div>
                <div><i class="fas fa-circle"></i> <strong>Estado:</strong> <span class="estado ${ticket.estado}">${estadoLabel}</span></div>
                <div><i class="fas fa-calendar"></i> <strong>Fecha creación:</strong> ${formatearFechaHora(fecha)}</div>
                <div><i class="fas fa-clock"></i> <strong>Días hábiles transcurridos:</strong> ${diasHabilesLabel}</div>
                ${fechaRecibido ? `<div><i class="fas fa-calendar-check"></i> <strong>Fecha de recibido (1er envío):</strong> ${formatearFechaSinHora(fechaRecibido)}</div>` : ''}
                ${fechaRespuesta ? `<div><i class="fas fa-check-circle"></i> <strong>Fecha de respuesta al ciudadano:</strong> ${formatearFechaSinHora(fechaRespuesta)}</div>` : ''}
            </div>
            
            <div class="mensaje-box">
                <strong><i class="fas fa-comment"></i> Mensaje:</strong>
                <p>${ticket.mensaje}</p>
            </div>
        </div>
        
        <div class="historial">
            <h3><i class="fas fa-history"></i> Historial de seguimiento</h3>
            ${historialHTML}
        </div>
        
        <div class="respuestas">
            <h3><i class="fas fa-reply"></i> Respuestas al ciudadano</h3>
            ${respuestasHTML}
        </div>
        
        <div style="margin-top: 20px; text-align: center;">
            <button onclick="cerrarModalVer()" class="btn-secondary"><i class="fas fa-times"></i> Cerrar</button>
            <button onclick="cerrarModalVer(); irSeguimiento('${ticket.id}')" class="btn-success"><i class="fas fa-arrow-right"></i> Ir a seguimiento</button>
        </div>
    `;

    modal.style.display = 'block';
}

function cerrarModalVer() {
    document.getElementById('modalVerTicket').style.display = 'none';
}

// ============ IR A SEGUIMIENTO ============
function irSeguimiento(id) {
    window.location.href = 'seguimiento.html?id=' + id;
}

// ============ ACTUALIZAR ESTADÍSTICAS ============
function actualizarEstadisticas(ticketsFiltrados) {
    // ===== ESTADO =====
    const total = ticketsFiltrados.length;
    const pendientes = ticketsFiltrados.filter(t => t.estado === 'pendiente').length;
    const enRevision = ticketsFiltrados.filter(t => t.estado === 'en_revision').length;
    const enProceso = ticketsFiltrados.filter(t => t.estado === 'en_proceso').length;
    const vencidos = ticketsFiltrados.filter(t => t.estado === 'vencido').length;
    const resueltos = ticketsFiltrados.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length;

    document.getElementById('totalTickets').textContent = total;
    document.getElementById('pendientes').textContent = pendientes;
    document.getElementById('enRevision').textContent = enRevision;
    document.getElementById('enProceso').textContent = enProceso;
    document.getElementById('vencidos').textContent = vencidos;
    document.getElementById('resueltos').textContent = resueltos;

    // ===== DEPENDENCIA =====
    const dependencias = {};
    ticketsFiltrados.forEach(t => {
        const dep = t.dependencia || 'Sin asignar';
        dependencias[dep] = (dependencias[dep] || 0) + 1;
    });

    let depHTML = '';
    const depOrder = ['sistemas', 'recursos_humanos', 'finanzas', 'operaciones', 'atencion_cliente', 'juridico', 'compras', 'Sin asignar'];
    const depLabels = {
        'sistemas': 'Sistemas',
        'recursos_humanos': 'Recursos Humanos',
        'finanzas': 'Finanzas',
        'operaciones': 'Operaciones',
        'atencion_cliente': 'Atención al Cliente',
        'juridico': 'Jurídico',
        'compras': 'Compras',
        'Sin asignar': 'Sin asignar'
    };

    depOrder.forEach(dep => {
        if (dependencias[dep]) {
            depHTML += `<div class="stat-card dep-${dep}"><span class="stat-number">${dependencias[dep]}</span><span class="stat-label">${depLabels[dep] || dep}</span></div>`;
        }
    });

    Object.keys(dependencias).forEach(dep => {
        if (!depOrder.includes(dep)) {
            depHTML += `<div class="stat-card"><span class="stat-number">${dependencias[dep]}</span><span class="stat-label">${dep}</span></div>`;
        }
    });

    document.getElementById('dependenciasStats').innerHTML = depHTML || '<p style="color: #999; text-align: center; padding: 10px;">Sin datos</p>';

    // ===== ASUNTO =====
    const asuntos = {};
    ticketsFiltrados.forEach(t => {
        const asu = t.asunto || 'pendiente_clasificar';
        asuntos[asu] = (asuntos[asu] || 0) + 1;
    });

    let asuHTML = '';
    const asuOrder = ['queja', 'sugerencia', 'felicitacion', 'otros', 'no_procede', 'pendiente_clasificar'];
    const asuLabels = {
        'queja': 'Queja',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación',
        'otros': 'Otros',
        'no_procede': 'No procede',
        'pendiente_clasificar': 'Por clasificar'
    };

    asuOrder.forEach(asu => {
        if (asuntos[asu]) {
            asuHTML += `<div class="stat-card asu-${asu}"><span class="stat-number">${asuntos[asu]}</span><span class="stat-label">${asuLabels[asu] || asu}</span></div>`;
        }
    });

    document.getElementById('asuntosStats').innerHTML = asuHTML || '<p style="color: #999; text-align: center; padding: 10px;">Sin datos</p>';
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
    switch (tipoFecha) {
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
    document.getElementById('filtroFechaContainer').innerHTML = '<p style="color: #999; font-size: 0.85em; padding: 5px 0;">Selecciona un tipo de filtro de fecha</p>';

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

console.log('admin.js cargado correctamente');