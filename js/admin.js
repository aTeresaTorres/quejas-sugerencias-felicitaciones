// ============ VARIABLES GLOBALES ============
let tickets = [];
let ticketActual = null;
let filtrosActuales = {};
let ticketsNuevos = new Set();
let todosLosTickets = [];
let dependenciasList = [];

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmailText').textContent = user.email;
        cargarDependencias().then(() => cargarTodosLosTickets());
    } else {
        window.location.href = 'login.html';
    }
});

// ============ CARGAR DEPENDENCIAS DESDE FIRESTORE ============
async function cargarDependencias() {
    try {
        const snapshot = await db.collection('dependencias').orderBy('nombre').get();
        dependenciasList = [];
        snapshot.forEach(doc => {
            dependenciasList.push({ id: doc.id, ...doc.data() });
        });
        
        if (dependenciasList.length === 0) {
            await crearDependenciasPredeterminadas();
            return cargarDependencias();
        }
        
        actualizarFiltrosDependencias();
    } catch (error) {
        console.error('Error al cargar dependencias:', error);
        dependenciasList = [
            { id: 'sistemas', nombre: 'Sistemas' },
            { id: 'recursos_humanos', nombre: 'Recursos Humanos' },
            { id: 'finanzas', nombre: 'Finanzas' },
            { id: 'operaciones', nombre: 'Operaciones' },
            { id: 'atencion_cliente', nombre: 'Atención al Cliente' },
            { id: 'juridico', nombre: 'Jurídico' },
            { id: 'compras', nombre: 'Compras' }
        ];
        actualizarFiltrosDependencias();
    }
}

async function crearDependenciasPredeterminadas() {
    const defaults = [
        { nombre: 'Sistemas', activo: true },
        { nombre: 'Recursos Humanos', activo: true },
        { nombre: 'Finanzas', activo: true },
        { nombre: 'Operaciones', activo: true },
        { nombre: 'Atención al Cliente', activo: true },
        { nombre: 'Jurídico', activo: true },
        { nombre: 'Compras', activo: true }
    ];
    
    const batch = db.batch();
    defaults.forEach(dep => {
        const ref = db.collection('dependencias').doc();
        batch.set(ref, dep);
    });
    await batch.commit();
}

function actualizarFiltrosDependencias() {
    const container = document.getElementById('filtroDependenciaContainer');
    container.innerHTML = '';
    
    dependenciasList.forEach(dep => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = dep.id;
        const span = document.createElement('span');
        span.className = 'check-count';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + dep.nombre + ' '));
        label.appendChild(span);
        container.appendChild(label);
        
        cb.addEventListener('change', aplicarFiltrosYBusqueda);
    });
}

// ============ CERRAR SESIÓN ============
document.getElementById('btnLogout').addEventListener('click', () => {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        auth.signOut();
    }
});

// ============ RECARGAR ============
document.getElementById('btnRecargar').addEventListener('click', () => {
    cargarTodosLosTickets();
});

// ============ BÚSQUEDA GLOBAL ============
document.getElementById('btnBuscar').addEventListener('click', () => {
    aplicarFiltrosYBusqueda();
});

document.getElementById('busquedaGlobal').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        aplicarFiltrosYBusqueda();
    }
});

document.getElementById('busquedaGlobal').addEventListener('input', () => {
    aplicarFiltrosYBusqueda();
});

document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => {
    document.getElementById('busquedaGlobal').value = '';
    aplicarFiltrosYBusqueda();
});

// ============ TOGGLE PARA ACORDEÓN ============
function toggleFiltro(id) {
    const content = document.getElementById('filtro' + id.charAt(0).toUpperCase() + id.slice(1));
    const icon = content?.previousElementSibling?.querySelector('.accordion-icon');
    if (content) {
        content.classList.toggle('open');
        if (icon) {
            icon.classList.toggle('open');
        }
    }
}

// ============ FILTROS DE FECHA DINÁMICOS ============
document.getElementById('tipoFiltroFecha').addEventListener('change', function() {
    const container = document.getElementById('filtroFechaContainer');
    const tipo = this.value;

    let html = '';
    const hoy = fechaHoyLocal();
    switch (tipo) {
        case 'anio':
            html = `<select id="filtroAnio">${generarOpcionesAnios()}</select>`;
            break;
        case 'mes':
            html = `<input type="month" id="filtroMes" max="${hoy.slice(0, 7)}">`;
            break;
        case 'periodo':
            html = `
                <div class="fecha-rango">
                    <input type="date" id="filtroDesde" max="${hoy}" placeholder="Desde">
                    <input type="date" id="filtroHasta" max="${hoy}" placeholder="Hasta">
                </div>
            `;
            break;
        case 'dia':
            html = `<input type="date" id="filtroDia" max="${hoy}">`;
            break;
        default:
            html = `<p style="color: var(--text-muted); font-size: 0.75rem;">Selecciona un tipo de filtro</p>`;
    }

    container.innerHTML = html;
    
    if (tipo !== 'ninguno') {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', aplicarFiltrosYBusqueda);
            input.addEventListener('input', aplicarFiltrosYBusqueda);
        });
        const selects = container.querySelectorAll('select');
        selects.forEach(select => {
            select.addEventListener('change', aplicarFiltrosYBusqueda);
        });
    }
});

function generarOpcionesAnios() {
    const anioActual = new Date().getFullYear();
    let options = '';
    for (let i = anioActual; i >= 2020; i--) {
        options += `<option value="${i}">${i}</option>`;
    }
    return options;
}

// ============ EVENTOS EN TIEMPO REAL PARA CHECKBOX ============
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            if (this.value === 'cualquier' && this.checked) {
                document.querySelectorAll('#filtroTipoAccionContainer input[type="checkbox"]').forEach(c => {
                    if (c.value !== 'cualquier') c.checked = false;
                });
            } else if (this.value !== 'cualquier' && this.checked) {
                const cualquier = document.querySelector('#filtroTipoAccionContainer input[value="cualquier"]');
                if (cualquier) cualquier.checked = false;
            }
            
            const acciones = document.querySelectorAll('#filtroTipoAccionContainer input[type="checkbox"]:checked');
            if (acciones.length === 0) {
                const cualquier = document.querySelector('#filtroTipoAccionContainer input[value="cualquier"]');
                if (cualquier) cualquier.checked = true;
            }
            
            aplicarFiltrosYBusqueda();
        });
    });
});

// ============ FUNCIONES DE FECHA ============
function fechaHoyLocal() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
function calcularDiasHabiles(fechaInicio, fechaFin) {
    const inicio = parseFechaLocal(fechaInicio);
    const fin = parseFechaLocal(fechaFin);
    if (!inicio || !fin) return null;

    let count = 0;
    const current = new Date(inicio);
    current.setHours(0, 0, 0, 0);
    const end = new Date(fin);
    end.setHours(0, 0, 0, 0);

    if (current >= end) return 0;

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

function obtenerFechaRecibidoPrimerEnvio(ticket) {
    const envios = ticket.enviosDependencia || [];
    if (envios.length === 0) return null;
    return envios[0].fechaRecibido || null;
}

function obtenerFechaRespuestaCiudadano(ticket) {
    const respuestas = ticket.respuestasCiudadano || [];
    if (respuestas.length > 0) {
        const ultima = respuestas[respuestas.length - 1];
        return ultima.fechaRespuesta || ultima.fecha;
    }
    return null;
}

// ============ OBTENER VALORES DE CHECKBOX ============
function getCheckboxValues(containerId) {
    const checks = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);
    return Array.from(checks).map(c => c.value);
}

// ============ CARGAR TODOS LOS TICKETS ============
async function cargarTodosLosTickets() {
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 30px;">Cargando tickets...</p>';

    try {
        if (typeof db === 'undefined') {
            container.innerHTML = '<p style="color: var(--danger);">Error: Firebase no está inicializado</p>';
            return;
        }

        const query = db.collection('tickets').orderBy('fechaCreacion', 'desc');
        const snapshot = await query.get();
        
        todosLosTickets = [];
        snapshot.forEach(doc => {
            todosLosTickets.push({ id: doc.id, ...doc.data() });
        });

        actualizarConteosCheckbox(todosLosTickets);
        aplicarFiltrosYBusqueda();

    } catch (error) {
        console.error('Error al cargar tickets:', error);
        container.innerHTML = `
            <p style="color: var(--danger); padding: 20px;">Error al cargar los tickets</p>
            <p style="color: var(--text-muted); font-size: 0.9em;">${error.message}</p>
        `;
    }
}

// ============ ACTUALIZAR CONTEOS EN CHECKBOX ============
function actualizarConteosCheckbox(ticketsData) {
    // Asuntos
    const asuntos = {};
    const asuLabels = {
        'queja': 'Queja',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación',
        'pendiente_clasificar': 'Por clasificar',
        'no_procede': 'No procede',
        'otros': 'Otros'
    };
    ticketsData.forEach(t => {
        const asu = t.asunto || 'pendiente_clasificar';
        asuntos[asu] = (asuntos[asu] || 0) + 1;
    });
    
    document.querySelectorAll('#filtroAsuntoContainer label').forEach(label => {
        const cb = label.querySelector('input[type="checkbox"]');
        const countSpan = label.querySelector('.check-count');
        if (cb && countSpan) {
            const count = asuntos[cb.value] || 0;
            countSpan.textContent = count > 0 ? count : '';
            countSpan.classList.toggle('active', count > 0);
        }
    });

    // Dependencias (usando dependenciasList)
    const dependencias = {};
    ticketsData.forEach(t => {
        const dep = t.dependencia || 'sin_asignar';
        dependencias[dep] = (dependencias[dep] || 0) + 1;
    });
    
    document.querySelectorAll('#filtroDependenciaContainer label').forEach(label => {
        const cb = label.querySelector('input[type="checkbox"]');
        const countSpan = label.querySelector('.check-count');
        if (cb && countSpan) {
            const count = dependencias[cb.value] || 0;
            countSpan.textContent = count > 0 ? count : '';
            countSpan.classList.toggle('active', count > 0);
        }
    });

    // Estados
    const estados = {};
    const estadoLabels = {
        'pendiente': 'Pendiente',
        'en_revision': 'En revisión',
        'en_proceso': 'En proceso',
        'vencido': 'Vencido',
        'resuelto': 'Resuelto',
        'cerrado': 'Cerrado'
    };
    ticketsData.forEach(t => {
        const est = t.estado || 'pendiente';
        estados[est] = (estados[est] || 0) + 1;
    });
    
    document.querySelectorAll('#filtroEstadoContainer label').forEach(label => {
        const cb = label.querySelector('input[type="checkbox"]');
        const countSpan = label.querySelector('.check-count');
        if (cb && countSpan) {
            const count = estados[cb.value] || 0;
            countSpan.textContent = count > 0 ? count : '';
            countSpan.classList.toggle('active', count > 0);
        }
    });
}

// ============ APLICAR FILTROS Y BÚSQUEDA ============
function aplicarFiltrosYBusqueda() {
    const filtros = obtenerFiltrosActuales();
    const ticketsFiltrados = filtrarTickets(todosLosTickets, filtros);
    
    const idsNuevos = new Set();
    ticketsFiltrados.forEach(t => {
        const esPendiente = t.estado === 'pendiente';
        const tieneHistorial = t.historialSeguimiento && t.historialSeguimiento.length > 0;
        if (esPendiente && !tieneHistorial && !ticketsNuevos.has(t.id)) {
            idsNuevos.add(t.id);
        }
        ticketsNuevos.add(t.id);
    });

    tickets = ticketsFiltrados;
    renderTickets(tickets, idsNuevos);
    actualizarEstadisticas(tickets);
    
    document.getElementById('contadorTickets').textContent = `(${tickets.length} tickets)`;
    
    const totalCount = document.querySelector('.total-count');
    if (totalCount) {
        totalCount.textContent = `(${tickets.length} de ${todosLosTickets.length})`;
    }
}

// ============ OBTENER FILTROS ACTUALES ============
function obtenerFiltrosActuales() {
    const filtros = {
        tipoFecha: document.getElementById('tipoFiltroFecha').value,
        busqueda: document.getElementById('busquedaGlobal').value.trim()
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

    const acciones = getCheckboxValues('filtroTipoAccionContainer');
    if (acciones.length > 0 && !acciones.includes('cualquier')) {
        filtros.acciones = acciones;
    }

    const asuntos = getCheckboxValues('filtroAsuntoContainer');
    if (asuntos.length > 0) {
        filtros.asuntos = asuntos;
    }

    const dependencias = getCheckboxValues('filtroDependenciaContainer');
    if (dependencias.length > 0) {
        filtros.dependencias = dependencias;
    }

    const estados = getCheckboxValues('filtroEstadoContainer');
    if (estados.length > 0) {
        filtros.estados = estados;
    }

    return filtros;
}

// ============ FILTRAR TICKETS ============
function filtrarTickets(ticketsData, filtros) {
    let resultado = [...ticketsData];

    if (filtros.busqueda) {
        const termino = filtros.busqueda.toLowerCase();
        resultado = resultado.filter(t => {
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

    if (filtros.asuntos && filtros.asuntos.length > 0) {
        resultado = resultado.filter(t => filtros.asuntos.includes(t.asunto));
    }

    if (filtros.estados && filtros.estados.length > 0) {
        resultado = resultado.filter(t => filtros.estados.includes(t.estado));
    }

    if (filtros.dependencias && filtros.dependencias.length > 0) {
        resultado = resultado.filter(t => filtros.dependencias.includes(t.dependencia));
    }

    const tipoFecha = filtros.tipoFecha;
    if (tipoFecha !== 'ninguno') {
        const acciones = filtros.acciones || ['cualquier'];
        
        resultado = resultado.filter(t => {
            const fechasPorAccion = obtenerFechasPorAccion(t);
            
            if (acciones.includes('cualquier') || acciones.length === 0) {
                return Object.values(fechasPorAccion).some(f => coincideConFiltroFecha(f, tipoFecha, filtros));
            }
            
            for (const accion of acciones) {
                const fechaObj = fechasPorAccion[accion];
                if (fechaObj && coincideConFiltroFecha(fechaObj, tipoFecha, filtros)) {
                    return true;
                }
            }
            return false;
        });
    }

    return resultado;
}

function obtenerFechasPorAccion(data) {
    const fechas = {};
    if (data.fechaCreacion) fechas.creacion = obtenerFechaCorrecta(data.fechaCreacion);
    if (data.fechaActualizacion) fechas.actualizacion = obtenerFechaCorrecta(data.fechaActualizacion);

    const envios = data.enviosDependencia || [];
    if (envios.length > 0) {
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
        if (f) fechas.respuesta_dependencia = ultima.fechaRespuesta ? parseFechaLocal(f) : obtenerFechaCorrecta(f);
    }

    const respCiu = data.respuestasCiudadano || [];
    if (respCiu.length > 0) {
        const ultima = respCiu[respCiu.length - 1];
        const f = ultima.fechaRespuesta || ultima.fecha;
        if (f) fechas.respuesta_ciudadano = ultima.fechaRespuesta ? parseFechaLocal(f) : obtenerFechaCorrecta(f);
    }

    if (data.fechaResolucion) fechas.resolucion = obtenerFechaCorrecta(data.fechaResolucion);
    return fechas;
}

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

// ============ RENDERIZAR TICKETS ============
function renderTickets(tickets, idsNuevos = new Set()) {
    const container = document.getElementById('ticketsContainer');

    if (tickets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 30px;">No hay tickets registrados con estos filtros</p>';
        return;
    }

    let html = '<table>';
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

        const depNombre = dependenciasList.find(d => d.id === ticket.dependencia)?.nombre || ticket.dependencia || 'Sin asignar';

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
                <td>${depNombre}</td>
                <td><span class="estado ${estadoClass}">${estadoLabel}</span></td>
                <td>${formatearFecha(fecha)}</td>
                <td>
                    <button onclick="verTicket('${ticket.id}')" class="btn-small btn-ver"><i class="fas fa-eye"></i> Ver</button>
                    <button onclick="irSeguimiento('${ticket.id}')" class="btn-small btn-seguimiento"><i class="fas fa-arrow-right"></i> Seguimiento</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============ VER TICKET ============
async function verTicket(id) {
    const ticket = tickets.find(t => t.id === id) || todosLosTickets.find(t => t.id === id);
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

    const depNombre = dependenciasList.find(d => d.id === ticket.dependencia)?.nombre || ticket.dependencia || 'Sin asignar';

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

    let historialHTML = '';
    if (ticket.historialSeguimiento && ticket.historialSeguimiento.length > 0) {
        historialHTML = ticket.historialSeguimiento.map(h => {
            const fechaH = new Date(h.fecha);
            return `
                <div class="historial-item">
                    <p><strong><i class="fas fa-tag"></i> ${h.accion}</strong></p>
                    <p><i class="fas fa-clock"></i> <strong>Fecha de registro:</strong> ${formatearFechaHora(fechaH)}</p>
                    <p><i class="fas fa-user"></i> <strong>Por:</strong> ${h.usuario || 'N/A'}</p>
                    ${h.descripcion ? `<p><i class="fas fa-info-circle"></i> ${h.descripcion}</p>` : ''}
                </div>
            `;
        }).join('');
    } else {
        historialHTML = '<p style="color: var(--text-muted);">Sin historial de seguimiento</p>';
    }

    let respuestasHTML = '';
    if (ticket.respuestasCiudadano && ticket.respuestasCiudadano.length > 0) {
        respuestasHTML = ticket.respuestasCiudadano.map(r => {
            const fechaR = new Date(r.fecha);
            const fechaResp = r.fechaRespuesta ? r.fechaRespuesta : null;
            return `
                <div class="respuesta-item">
                    <p><strong>Descripción:</strong> ${r.descripcion}</p>
                    <p><i class="fas fa-calendar-check"></i> <strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFechaSinHora(fechaResp) : 'N/A'}</p>
                    <hr style="border: none; border-top: 1px dashed var(--border); margin: 8px 0;">
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        <i class="fas fa-clock"></i> <strong>Registrado:</strong> ${formatearFechaHora(fechaR)}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        <i class="fas fa-user"></i> <strong>Por:</strong> ${r.usuario || 'N/A'}
                    </p>
                </div>
            `;
        }).join('');
    } else {
        respuestasHTML = '<p style="color: var(--text-muted);">Sin respuestas al ciudadano</p>';
    }

    detalle.innerHTML = `
        <h2><i class="fas fa-ticket-alt"></i> Ticket ${ticket.folio}</h2>
        
        <div class="ticket-info">
            <div class="info-grid">
                <div><i class="fas fa-user"></i> <strong>Nombre:</strong> ${ticket.nombre}</div>
                ${contactosHTML}
                <div><i class="fas fa-tag"></i> <strong>Asunto:</strong> <span style="font-weight: bold;">${asuntoLabel}</span></div>
                <div><i class="fas fa-building"></i> <strong>Dependencia:</strong> ${depNombre}</div>
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
            <button onclick="cerrarModalVer()" style="background: var(--border); border: none; padding: 8px 20px; border-radius: var(--radius); cursor: pointer; font-weight: 600; color: var(--text-secondary);"><i class="fas fa-times"></i> Cerrar</button>
            <button onclick="cerrarModalVer(); irSeguimiento('${ticket.id}')" style="background: var(--success); border: none; padding: 8px 20px; border-radius: var(--radius); cursor: pointer; font-weight: 600; color: white;"><i class="fas fa-arrow-right"></i> Ir a seguimiento</button>
        </div>
    `;

    modal.style.display = 'block';
}

function cerrarModalVer() {
    document.getElementById('modalVerTicket').style.display = 'none';
}

function irSeguimiento(id) {
    window.location.href = 'seguimiento.html?id=' + id;
}

// ============ ACTUALIZAR ESTADÍSTICAS ============
function actualizarEstadisticas(ticketsFiltrados) {
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

    // Dependencias
    const dependencias = {};
    ticketsFiltrados.forEach(t => {
        const dep = t.dependencia || 'sin_asignar';
        dependencias[dep] = (dependencias[dep] || 0) + 1;
    });

    let depHTML = '';
    Object.keys(dependencias).forEach(dep => {
        const depNombre = dependenciasList.find(d => d.id === dep)?.nombre || dep;
        depHTML += `<span class="stat-mini"><span class="num">${dependencias[dep]}</span> ${depNombre}</span>`;
    });
    document.getElementById('dependenciasStats').innerHTML = depHTML || '<span style="color: var(--text-muted);">Sin datos</span>';

    // Asuntos
    const asuntos = {};
    ticketsFiltrados.forEach(t => {
        const asu = t.asunto || 'pendiente_clasificar';
        asuntos[asu] = (asuntos[asu] || 0) + 1;
    });

    const asuLabels = {
        'queja': 'Queja',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación',
        'otros': 'Otros',
        'no_procede': 'No procede',
        'pendiente_clasificar': 'Por clasificar'
    };

    let asuHTML = '';
    Object.keys(asuntos).forEach(asu => {
        asuHTML += `<span class="stat-mini"><span class="num">${asuntos[asu]}</span> ${asuLabels[asu] || asu}</span>`;
    });
    document.getElementById('asuntosStats').innerHTML = asuHTML || '<span style="color: var(--text-muted);">Sin datos</span>';
}

// ============ LIMPIAR FILTROS ============
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('tipoFiltroFecha').value = 'ninguno';
    document.getElementById('filtroFechaContainer').innerHTML = 
        '<p style="color: var(--text-muted); font-size: 0.75rem;">Selecciona un tipo de filtro</p>';

    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    const cualquierCheck = document.querySelector('#filtroTipoAccionContainer input[value="cualquier"]');
    if (cualquierCheck) cualquierCheck.checked = true;

    document.getElementById('busquedaGlobal').value = '';

    aplicarFiltrosYBusqueda();
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

// ============ INICIALIZAR ============
document.addEventListener('DOMContentLoaded', function() {
    const cualquierCheck = document.querySelector('#filtroTipoAccionContainer input[value="cualquier"]');
    if (cualquierCheck) cualquierCheck.checked = true;
    
    // Abrir el primer acordeón por defecto
    const firstContent = document.querySelector('.accordion-content');
    if (firstContent) {
        firstContent.classList.add('open');
        const icon = firstContent.previousElementSibling?.querySelector('.accordion-icon');
        if (icon) icon.classList.add('open');
    }
});

console.log('✅ admin.js cargado correctamente');