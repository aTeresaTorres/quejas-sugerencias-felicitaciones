// ============ VARIABLES GLOBALES ============
let ticketId = null;
let ticketData = null;
let diasHabilesTranscurridos = 0;
let dependenciasList = [];

// ============ OBTENER ID DEL TICKET ============
const urlParams = new URLSearchParams(window.location.search);
ticketId = urlParams.get('id');

if (!ticketId) {
    mostrarError('Error', 'No se especificó un ticket');
    setTimeout(() => window.location.href = 'admin.html', 2000);
}

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
        
        llenarSelectDependencias();
    } catch (error) {
        console.error('Error al cargar dependencias:', error);
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

function llenarSelectDependencias() {
    const select = document.getElementById('dependenciaTicket');
    select.innerHTML = '<option value="">-- Seleccionar dependencia --</option>';
    dependenciasList.forEach(dep => {
        const option = document.createElement('option');
        option.value = dep.id;
        option.textContent = dep.nombre;
        select.appendChild(option);
    });
}

// ============ MODAL DE ERROR ============
function mostrarError(titulo, mensaje) {
    const modal = document.getElementById('errorModal');
    document.getElementById('errorTitle').textContent = titulo || 'Error';
    document.getElementById('errorMessage').textContent = mensaje || 'Ocurrió un error inesperado';
    modal.classList.add('show');
}

function cerrarErrorModal() {
    document.getElementById('errorModal').classList.remove('show');
}

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmail').textContent = '👤 ' + user.email;
        cargarDependencias().then(() => cargarTicket());
    } else {
        window.location.href = 'login.html';
    }
});

// ============ FUNCIONES AUXILIARES DE FECHA ============
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    const d = parseFechaLocal(fecha);
    return d ? d.toLocaleDateString('es-MX') : 'N/A';
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

function fechaHoy() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseFechaLocal(fecha) {
    if (!fecha) return null;
    
    // Si es Timestamp de Firestore
    if (fecha.toDate) {
        return fecha.toDate();
    }
    
    // Si ya es un objeto Date
    if (fecha instanceof Date) {
        return fecha;
    }
    
    // Si es string
    if (typeof fecha === 'string') {
        // Si viene en formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return new Date(fecha + 'T00:00:00');
        }
        // Si es ISO
        return new Date(fecha);
    }
    
    return null;
}

// Función mejorada para obtener fecha en formato YYYY-MM-DD
function obtenerFechaStr(fecha) {
    if (!fecha) return '';
    const d = parseFechaLocal(fecha);
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============ FUNCIONES DE VALIDACIÓN DE FECHAS ============
function fechaMenorOIgual(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return true;
    const d1 = parseFechaLocal(fecha1);
    const d2 = parseFechaLocal(fecha2);
    if (!d1 || !d2) return true;
    const d1Norm = new Date(d1);
    d1Norm.setHours(0, 0, 0, 0);
    const d2Norm = new Date(d2);
    d2Norm.setHours(0, 0, 0, 0);
    return d1Norm <= d2Norm;
}

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
        '2026-01-01', '2026-02-02', '2026-03-16', '2026-04-02', '2026-04-03', 
        '2026-05-01', '2026-09-16', '2026-11-02', '2026-11-16', '2026-12-25'
    ];

    current.setDate(current.getDate() + 1);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dd}`;

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !diasFestivos.includes(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// ============ HELPERS ============
function obtenerEnvioPrincipal() {
    const envios = ticketData.enviosDependencia || [];
    return envios.length > 0 ? envios[0] : null;
}

function obtenerEnviosAdicionales() {
    const envios = ticketData.enviosDependencia || [];
    return envios.length > 1 ? envios.slice(1) : [];
}

function obtenerFechaRecibidoPrimerEnvio() {
    const principal = obtenerEnvioPrincipal();
    return principal ? (principal.fechaRecibido || null) : null;
}

// ============ MOSTRAR LOADING ============
function mostrarLoading(btn) {
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Procesando...';
    btn.disabled = true;
    return textoOriginal;
}

function ocultarLoading(btn, textoOriginal) {
    btn.textContent = textoOriginal;
    btn.disabled = false;
}

// ============ CARGAR TICKET ============
async function cargarTicket() {
    try {
        const doc = await db.collection('tickets').doc(ticketId).get();
        if (!doc.exists) {
            mostrarError('Ticket no encontrado', 'El ticket que buscas no existe o fue eliminado');
            setTimeout(() => window.location.href = 'admin.html', 2000);
            return;
        }

        ticketData = { id: doc.id, ...doc.data() };
        mostrarTicket();

    } catch (error) {
        console.error('Error al cargar ticket:', error);
        mostrarError('Error al cargar', 'No se pudo cargar el ticket: ' + error.message);
    }
}

// ============ VERIFICAR SI SE PUEDE AVANZAR ============
function puedeAvanzar(pasoRequerido) {
    if (ticketData.estado === 'cerrado' && ticketData.asunto === 'no_procede') {
        mostrarError('Ticket cerrado', 'Este ticket fue cerrado como "No procede"');
        return false;
    }

    const paso = pasoRequerido || 0;

    switch (paso) {
        case 2:
            if (ticketData.asunto === 'pendiente_clasificar' || !ticketData.dependencia || ticketData.dependencia === 'sin_asignar' || ticketData.dependencia === '') {
                mostrarError('Paso incompleto', 'Primero debes clasificar el asunto y asignar dependencia (Paso 1)');
                return false;
            }
            break;
        case 3:
            if (!ticketData.enviosDependencia || ticketData.enviosDependencia.length === 0) {
                mostrarError('Paso incompleto', 'Primero debes registrar el envío a dependencia (Paso 2)');
                return false;
            }
            const respuestasDep = ticketData.respuestasDependencia || [];
            if (respuestasDep.length > 0) {
                mostrarError('No permitido', 'Ya se registró la respuesta de la dependencia. No se pueden agregar más envíos adicionales.');
                return false;
            }
            break;
        case 4:
            if (!ticketData.enviosDependencia || ticketData.enviosDependencia.length === 0) {
                mostrarError('Paso incompleto', 'Primero debes registrar el envío a dependencia (Paso 2)');
                return false;
            }
            const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
            if (!fechaRecibido) {
                mostrarError('Paso incompleto', 'Debes actualizar la fecha de recibido del primer envío antes de continuar');
                return false;
            }
            break;
        case 5:
            if (!ticketData.respuestasDependencia || ticketData.respuestasDependencia.length === 0) {
                mostrarError('Paso incompleto', 'Primero debes registrar la respuesta de la dependencia (Paso 4)');
                return false;
            }
            break;
        case 6:
            if (!ticketData.respuestasCiudadano || ticketData.respuestasCiudadano.length === 0) {
                mostrarError('Paso incompleto', 'Primero debes registrar la respuesta al ciudadano (Paso 5)');
                return false;
            }
            break;
    }

    return true;
}

// ============ MOSTRAR TICKET ============
function mostrarTicket() {
    const t = ticketData;

    document.getElementById('folioTicket').textContent = t.folio;
    document.getElementById('nombreTicket').textContent = t.nombre;
    document.getElementById('emailTicket').textContent = t.email || 'No proporcionado';
    document.getElementById('telefonoTicket').textContent = t.telefono || 'No proporcionado';
    document.getElementById('fechaCreacionTicket').textContent = formatearFechaHora(t.fechaCreacion);
    document.getElementById('mensajeUsuario').textContent = t.mensaje || 'Sin mensaje';

    const estadoLabel = {
        'pendiente': 'Pendiente',
        'en_revision': 'En revisión',
        'en_proceso': 'En proceso',
        'vencido': 'Vencido',
        'resuelto': 'Resuelto',
        'cerrado': 'Cerrado'
    }[t.estado] || t.estado;

    const estadoEl = document.getElementById('estadoTicket');
    estadoEl.textContent = estadoLabel;
    estadoEl.className = 'estado ' + t.estado;

    const asuntoSelect = document.getElementById('asuntoTicket');
    if (t.asunto === 'pendiente_clasificar' || !t.asunto) {
        asuntoSelect.value = 'pendiente_clasificar';
    } else {
        asuntoSelect.value = t.asunto;
    }
    
    const depSelect = document.getElementById('dependenciaTicket');
    if (t.dependencia && t.dependencia !== 'sin_asignar' && t.dependencia !== '') {
        depSelect.value = t.dependencia;
    } else {
        depSelect.value = '';
    }

    if (t.asunto === 'no_procede') {
        document.getElementById('dependenciaTicket').disabled = true;
        ocultarPasos(true);
        return;
    } else {
        document.getElementById('dependenciaTicket').disabled = false;
    }

    mostrarPaso1();
    mostrarEnvioDependencia();
    mostrarRespuestaDependencia();
    mostrarRespuestaCiudadano();
    cargarHistorial();
    actualizarContadorDias();
    cargarEnviosAdicionales();
}

// ============ OCULTAR/MOSTRAR PASOS ============
function ocultarPasos(ocultar) {
    const pasos = ['paso2', 'paso3', 'paso4', 'paso5', 'paso6', 'contadorDias'];
    pasos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = ocultar ? 'none' : 'block';
        }
    });
}

function mostrarPaso(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'block';
    }
}

// ============ PASO 1: MOSTRAR ============
function mostrarPaso1() {
    const t = ticketData;
    const tieneDatos = t.asunto && t.asunto !== 'pendiente_clasificar' && t.dependencia && t.dependencia !== 'sin_asignar' && t.dependencia !== '';

    if (tieneDatos) {
        document.getElementById('formPaso1').style.display = 'none';
        document.getElementById('paso1Registrado').style.display = 'block';

        const asuntoLabel = {
            'queja': 'Queja',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'otros': 'Otros',
            'no_procede': 'No procede'
        }[t.asunto] || t.asunto;

        const depNombre = dependenciasList.find(d => d.id === t.dependencia)?.nombre || t.dependencia || 'Sin asignar';

        document.getElementById('paso1Data').innerHTML = `
            <p><strong>Asunto:</strong> ${asuntoLabel}</p>
            <p><strong>Dependencia:</strong> ${depNombre}</p>
            <p><strong>Estado:</strong> ${t.estado}</p>
        `;

        if (t.asunto !== 'no_procede') {
            mostrarPaso('paso2');
        }
    } else {
        ocultarPasos(true);
        document.getElementById('paso2').style.display = 'none';
    }
}

// ============ PASO 1: ACTUALIZAR ============
async function actualizarDatosTicket() {
    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const asunto = document.getElementById('asuntoTicket').value;
    const dependencia = document.getElementById('dependenciaTicket').value;

    if (asunto === 'pendiente_clasificar') {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campo incompleto', 'Por favor, selecciona un asunto válido');
        return;
    }

    if (!dependencia || dependencia === '') {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campo incompleto', 'Por favor, selecciona una dependencia');
        return;
    }

    if (asunto === 'no_procede') {
        try {
            await db.collection('tickets').doc(ticketId).update({
                asunto: asunto,
                dependencia: null,
                estado: 'cerrado',
                fechaActualizacion: new Date().toISOString()
            });

            await agregarHistorial('Ticket cerrado', 'Asunto clasificado como "No procede"');
            ocultarLoading(btn, textoOriginal);
            cargarTicket();
            return;
        } catch (error) {
            console.error('Error:', error);
            ocultarLoading(btn, textoOriginal);
            mostrarError('Error al actualizar', error.message);
            return;
        }
    }

    try {
        await db.collection('tickets').doc(ticketId).update({
            asunto: asunto,
            dependencia: dependencia,
            estado: 'en_revision',
            fechaActualizacion: new Date().toISOString()
        });

        const depNombre = dependenciasList.find(d => d.id === dependencia)?.nombre || dependencia;
        await agregarHistorial('Actualización de datos', 'Asunto: ' + asunto + ', Dependencia: ' + depNombre);

        ocultarLoading(btn, textoOriginal);
        cargarTicket();

    } catch (error) {
        console.error('Error al actualizar:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al actualizar', error.message);
    }
}

// ============ PASO 2: MOSTRAR ENVÍO (CORREGIDO) ============
function mostrarEnvioDependencia() {
    const envioPrincipal = obtenerEnvioPrincipal();

    if (!envioPrincipal) {
        document.getElementById('formEnvioDependencia').style.display = 'block';
        document.getElementById('envioDependenciaRegistrado').style.display = 'none';

        // Obtener fecha de creación correctamente
        let fechaCreacion = ticketData.fechaCreacion;
        let hoy = fechaHoy();
        
        // Convertir fecha de creación a string YYYY-MM-DD
        let minFecha = '';
        if (fechaCreacion) {
            const parsed = parseFechaLocal(fechaCreacion);
            if (parsed && !isNaN(parsed.getTime())) {
                minFecha = obtenerFechaStr(parsed);
            }
        }

        // 🔥 CORRECCIÓN: Si minFecha es mayor que hoy, usar hoy como mínimo
        // Esto puede pasar si la fecha de creación es posterior a hoy por zona horaria
        if (minFecha && minFecha > hoy) {
            console.warn('⚠️ minFecha (' + minFecha + ') es mayor que hoy (' + hoy + '). Usando hoy como mínimo.');
            minFecha = hoy;
        }

        // Si no hay minFecha, usar hoy
        if (!minFecha) {
            minFecha = hoy;
        }

        const fechaElabInput = document.getElementById('fechaElaboracion');
        const fechaRecInput = document.getElementById('fechaRecibidoDependencia');

        // Establecer atributos
        fechaElabInput.setAttribute('min', minFecha);
        fechaElabInput.setAttribute('max', hoy);
        fechaRecInput.setAttribute('max', hoy);
        fechaRecInput.setAttribute('min', minFecha);

        // Si minFecha === hoy, pre-seleccionar hoy para facilitar
        if (minFecha === hoy) {
            fechaElabInput.value = hoy;
        }

        // Debug en consola
        console.log('📅 Fechas configuradas - min:', minFecha, 'max:', hoy);

        return;
    }

    document.getElementById('formEnvioDependencia').style.display = 'none';
    document.getElementById('envioDependenciaRegistrado').style.display = 'block';

    const fecha = new Date(envioPrincipal.fecha);
    const fechaElab = envioPrincipal.fechaElaboracion ? envioPrincipal.fechaElaboracion : null;
    const fechaRec = envioPrincipal.fechaRecibido ? envioPrincipal.fechaRecibido : null;

    document.getElementById('envioDependenciaData').innerHTML = `
        <p><strong>Descripción:</strong> ${envioPrincipal.descripcion}</p>
        <p><strong>Oficio:</strong> ${envioPrincipal.oficio}</p>
        <p><strong>Fecha de elaboración:</strong> ${fechaElab ? formatearFecha(fechaElab) : 'N/A'}</p>
        <p><strong>Fecha de recibido:</strong> ${fechaRec ? formatearFecha(fechaRec) : 'No registrada'}</p>
        <p><strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
        <p><strong>Registrado por:</strong> ${envioPrincipal.usuario}</p>
    `;

    const btnActualizar = document.querySelector('#envioDependenciaRegistrado .btn-secondary');
    if (btnActualizar) {
        if (envioPrincipal.fechaRecibido) {
            btnActualizar.style.display = 'none';
        } else {
            btnActualizar.style.display = 'inline-block';
        }
    }

    if (envioPrincipal.fechaRecibido) {
        mostrarPaso('paso4');
        mostrarPaso('contadorDias');
    }
}

// ============ PASO 2: ACTUALIZAR FECHA DE RECIBIDO ============
function editarFechaRecibido() {
    const envioPrincipal = obtenerEnvioPrincipal();
    if (!envioPrincipal) {
        mostrarError('Error', 'No hay envío principal registrado');
        return;
    }

    const fechaElaboracion = envioPrincipal.fechaElaboracion || '';
    const hoy = fechaHoy();

    // Obtener fecha mínima correcta
    let minFecha = '';
    if (fechaElaboracion) {
        const parsed = parseFechaLocal(fechaElaboracion);
        if (parsed && !isNaN(parsed.getTime())) {
            minFecha = obtenerFechaStr(parsed);
        }
    }
    if (!minFecha) minFecha = hoy;

    const modal = document.createElement('div');
    modal.id = 'modalFechaRecibido';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(26, 42, 58, 0.6); display: flex; justify-content: center;
        align-items: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <h3 style="margin-bottom: 20px; color: #1a3a5c;">Actualizar fecha de recibido</h3>
            <div class="form-group">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #1a3a5c;">Nueva fecha de recibido <span class="required">*</span></label>
                <input type="date" id="nuevaFechaRecibido" 
                       min="${minFecha}" max="${hoy}"
                       style="width: 100%; padding: 10px; border: 2px solid #d0d8e0; border-radius: 6px; font-size: 16px;">
                <small style="color: #7a8a9a; display: block; margin-top: 4px;">Debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)})</small>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="btnConfirmarFecha" class="btn-success" style="flex: 1;">Actualizar</button>
                <button id="btnCancelarFecha" style="flex: 1; background: #4a5a6a; color: white; border: none; border-radius: 6px; padding: 10px; cursor: pointer;">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnConfirmarFecha').addEventListener('click', function() {
        const fechaInput = document.getElementById('nuevaFechaRecibido');
        const nuevaFecha = fechaInput.value;

        if (!nuevaFecha) {
            mostrarError('Campo incompleto', 'Por favor, selecciona una fecha');
            return;
        }

        const modalEl = document.getElementById('modalFechaRecibido');
        if (modalEl) modalEl.remove();

        actualizarFechaRecibido(nuevaFecha);
    });

    document.getElementById('btnCancelarFecha').addEventListener('click', function() {
        const modalEl = document.getElementById('modalFechaRecibido');
        if (modalEl) modalEl.remove();
    });

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });

    setTimeout(() => {
        document.getElementById('nuevaFechaRecibido').focus();
    }, 100);
}

async function actualizarFechaRecibido(nuevaFecha) {
    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const envios = data.enviosDependencia || [];

        if (envios.length === 0) {
            mostrarError('Error', 'No se encontró el envío principal');
            return;
        }

        const fechaElaboracion = envios[0].fechaElaboracion;
        if (fechaElaboracion && !fechaMenorOIgual(fechaElaboracion, nuevaFecha)) {
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser anterior a la fecha de elaboración');
            return;
        }

        envios[0].fechaRecibido = nuevaFecha;

        await docRef.update({
            enviosDependencia: envios,
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Actualización de fecha de recibido', 'Nueva fecha: ' + formatearFecha(nuevaFecha));

        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al actualizar', error.message);
    }
}

// ============ PASO 2: REGISTRAR ENVÍO ============
async function registrarEnvioDependencia() {
    if (!puedeAvanzar(2)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionEnvio').value.trim();
    const oficio = document.getElementById('oficioEnvio').value.trim();
    const fechaElaboracion = document.getElementById('fechaElaboracion').value;
    const fechaRecibido = document.getElementById('fechaRecibidoDependencia').value || null;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fechaElaboracion) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campos incompletos', 'Por favor, completa todos los campos obligatorios');
        return;
    }

    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = obtenerFechaStr(fechaCreacion);
        if (fechaCreacionStr && !fechaMenorOIgual(fechaCreacionStr, fechaElaboracion)) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            return;
        }
    }

    if (fechaElaboracion > hoy) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de elaboración no puede ser futura');
        return;
    }

    if (fechaRecibido) {
        if (fechaRecibido > hoy) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser futura');
            return;
        }
        if (!fechaMenorOIgual(fechaElaboracion, fechaRecibido)) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser anterior a la fecha de elaboración');
            return;
        }
    }

    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const enviosActuales = data.enviosDependencia || [];

        if (enviosActuales.length > 0) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Ya registrado', 'Ya existe un envío principal registrado para este ticket.');
            cargarTicket();
            return;
        }

        const envio = {
            fecha: new Date().toISOString(),
            fechaElaboracion: fechaElaboracion,
            fechaRecibido: fechaRecibido,
            oficio: oficio,
            descripcion: descripcion,
            usuario: auth.currentUser.email,
            tipo: 'envio_dependencia'
        };

        enviosActuales.push(envio);

        await docRef.update({
            enviosDependencia: enviosActuales,
            fechaEnvioDependencia: new Date().toISOString(),
            estado: 'en_proceso',
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Envío a dependencia', 'Oficio: ' + oficio + ' - ' + descripcion);

        ocultarLoading(btn, textoOriginal);
        cargarTicket();

    } catch (error) {
        console.error('Error al registrar envío:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al registrar', error.message);
    }
}

// ============ PASO 3: ENVÍOS ADICIONALES ============
function agregarEnvioAdicional() {
    if (!puedeAvanzar(3)) return;

    const container = document.getElementById('enviosAdicionalesContainer');
    const hoy = fechaHoy();
    const fechaCreacion = ticketData.fechaCreacion;
    const minFecha = fechaCreacion ? obtenerFechaStr(fechaCreacion) : hoy;

    const primerEnvio = obtenerEnvioPrincipal();
    let fechaMinimaAdicional = minFecha || hoy;

    if (primerEnvio && primerEnvio.fechaRecibido) {
        const fechaRecibido = parseFechaLocal(primerEnvio.fechaRecibido);
        if (fechaRecibido && !isNaN(fechaRecibido.getTime())) {
            let dias = 0;
            const temp = new Date(fechaRecibido);
            while (dias < 10) {
                temp.setDate(temp.getDate() + 1);
                const dayOfWeek = temp.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    dias++;
                }
            }
            fechaMinimaAdicional = obtenerFechaStr(temp);
        }
    }

    const div = document.createElement('div');
    div.className = 'envio-adicional';
    div.innerHTML = `
        <div>
            <h4>Envío adicional #${container.querySelectorAll('.envio-adicional').length + 1}</h4>
            <div class="form-row">
                <div class="form-group full-width">
                    <label>Descripción <span class="required">*</span></label>
                    <textarea class="desc-adicional" rows="4" placeholder="Describe el envío..."></textarea>
                </div>
                <div class="form-group">
                    <label>Oficio <span class="required">*</span></label>
                    <input class="oficio-adicional" type="text" placeholder="Ej: OF-2026-002">
                </div>
                <div class="form-group">
                    <label>Fecha elaboración <span class="required">*</span></label>
                    <input class="fecha-elaboracion-adicional" type="date" min="${fechaMinimaAdicional}" max="${hoy}">
                    <small>Mínimo: ${formatearFecha(fechaMinimaAdicional)} (10 días hábiles después del recibido)</small>
                </div>
                <div class="form-group">
                    <label>Fecha recibido</label>
                    <input class="fecha-recibido-adicional" type="date" max="${hoy}">
                    <small>Opcional</small>
                </div>
            </div>
            <button onclick="registrarEnvioAdicional(this)" class="btn-success" style="margin-top: 10px;">Registrar envío</button>
            <button onclick="this.parentElement.remove()" style="background: #8b1a1a; margin-top: 10px; margin-left: 10px; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Eliminar</button>
        </div>
    `;

    const fechaElabInput = div.querySelector('.fecha-elaboracion-adicional');
    const fechaRecInput = div.querySelector('.fecha-recibido-adicional');

    fechaElabInput.addEventListener('change', function() {
        const fechaElab = this.value;
        const fechaRec = fechaRecInput.value;
        if (fechaRec && fechaElab && !fechaMenorOIgual(fechaElab, fechaRec)) {
            fechaRecInput.value = '';
            fechaRecInput.style.borderColor = '#8b1a1a';
        } else if (fechaRec && fechaElab) {
            fechaRecInput.style.borderColor = '';
        }
    });

    fechaRecInput.addEventListener('change', function() {
        const fechaRec = this.value;
        const fechaElab = fechaElabInput.value;
        if (fechaRec && fechaElab && !fechaMenorOIgual(fechaElab, fechaRec)) {
            this.value = '';
            this.style.borderColor = '#8b1a1a';
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser anterior a la fecha de elaboración');
        } else if (fechaRec && fechaElab) {
            this.style.borderColor = '';
        }
    });

    container.appendChild(div);
}

async function registrarEnvioAdicional(btn) {
    const textoOriginal = mostrarLoading(btn);
    const parent = btn.parentElement;
    const descripcion = parent.querySelector('.desc-adicional').value.trim();
    const oficio = parent.querySelector('.oficio-adicional').value.trim();
    const fechaElaboracion = parent.querySelector('.fecha-elaboracion-adicional').value;
    const fechaRecibido = parent.querySelector('.fecha-recibido-adicional').value || null;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fechaElaboracion) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campos incompletos', 'Por favor, completa todos los campos obligatorios');
        return;
    }

    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = obtenerFechaStr(fechaCreacion);
        if (fechaCreacionStr && !fechaMenorOIgual(fechaCreacionStr, fechaElaboracion)) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            return;
        }
    }

    if (fechaElaboracion > hoy) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de elaboración no puede ser futura');
        return;
    }

    if (fechaRecibido) {
        if (fechaRecibido > hoy) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser futura');
            return;
        }
        if (!fechaMenorOIgual(fechaElaboracion, fechaRecibido)) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser anterior a la fecha de elaboración');
            return;
        }
    }

    if (!puedeAvanzar(3)) {
        ocultarLoading(btn, textoOriginal);
        return;
    }

    try {
        const envio = {
            fecha: new Date().toISOString(),
            fechaElaboracion: fechaElaboracion,
            fechaRecibido: fechaRecibido,
            oficio: oficio,
            descripcion: descripcion,
            usuario: auth.currentUser.email,
            tipo: 'envio_adicional'
        };

        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();

        const enviosActuales = data.enviosDependencia || [];

        if (enviosActuales.length === 0) {
            ocultarLoading(btn, textoOriginal);
            mostrarError('Error', 'No existe un envío principal (Paso 2) registrado todavía.');
            return;
        }

        enviosActuales.push(envio);

        await docRef.update({
            enviosDependencia: enviosActuales,
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Envío adicional a dependencia', 'Oficio: ' + oficio + ' - ' + descripcion);

        ocultarLoading(btn, textoOriginal);
        parent.remove();
        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al registrar', error.message);
    }
}

function cargarEnviosAdicionales() {
    const container = document.getElementById('enviosAdicionalesContainer');
    const adicionales = obtenerEnviosAdicionales();

    const paso3Div = document.getElementById('paso3');
    const btnAgregar = document.getElementById('btnAgregarEnvioAdicional');

    const respuestasDep = ticketData.respuestasDependencia || [];
    const tieneRespuestaDep = respuestasDep.length > 0;

    if (tieneRespuestaDep) {
        paso3Div.style.display = 'none';
        return;
    }

    if (adicionales.length === 0) {
        container.innerHTML = '<p style="color: #7a8a9a;">No hay envíos adicionales</p>';
        if (btnAgregar) btnAgregar.style.display = 'inline-block';
        return;
    }

    if (btnAgregar) btnAgregar.style.display = 'inline-block';

    let html = '';
    adicionales.forEach((envio, index) => {
        const fecha = new Date(envio.fecha);
        const fechaElab = envio.fechaElaboracion ? envio.fechaElaboracion : null;
        const fechaRec = envio.fechaRecibido ? envio.fechaRecibido : null;

        const tieneFechaRecibido = !!envio.fechaRecibido;

        html += `
            <div class="envio-item">
                <p><strong>Envío adicional #${index + 1}</strong> - ${formatearFechaHora(fecha)}</p>
                <p><strong>Oficio:</strong> ${envio.oficio}</p>
                <p><strong>Descripción:</strong> ${envio.descripcion}</p>
                <p><small>Elaboración: ${fechaElab ? formatearFecha(fechaElab) : 'N/A'} | Recibido: ${fechaRec ? formatearFecha(fechaRec) : 'No registrado'}</small></p>
                <p><small>Por: ${envio.usuario}</small></p>
                ${!tieneFechaRecibido ? `<button onclick="editarFechaRecibidoAdicional('${index}')" class="btn-secondary" style="margin-top: 5px; font-size: 12px; padding: 5px 12px;">Actualizar fecha de recibido</button>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============ ACTUALIZAR FECHA DE RECIBIDO PARA ENVÍO ADICIONAL ============
function editarFechaRecibidoAdicional(index) {
    const adicionales = obtenerEnviosAdicionales();

    if (index >= adicionales.length) {
        mostrarError('Error', 'Envío no encontrado');
        return;
    }

    const envio = adicionales[index];
    const fechaElaboracion = envio.fechaElaboracion || '';
    const hoy = fechaHoy();

    let minFecha = '';
    if (fechaElaboracion) {
        const parsed = parseFechaLocal(fechaElaboracion);
        if (parsed && !isNaN(parsed.getTime())) {
            minFecha = obtenerFechaStr(parsed);
        }
    }
    if (!minFecha) minFecha = hoy;

    const modal = document.createElement('div');
    modal.id = 'modalFechaRecibidoAdicional';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(26, 42, 58, 0.6); display: flex; justify-content: center;
        align-items: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <h3 style="margin-bottom: 20px; color: #1a3a5c;">Actualizar fecha de recibido</h3>
            <div class="form-group">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #1a3a5c;">Nueva fecha de recibido <span class="required">*</span></label>
                <input type="date" id="nuevaFechaRecibidoAdicional" 
                       min="${minFecha}" max="${hoy}"
                       style="width: 100%; padding: 10px; border: 2px solid #d0d8e0; border-radius: 6px; font-size: 16px;">
                <small style="color: #7a8a9a; display: block; margin-top: 4px;">Debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)})</small>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="btnConfirmarFechaAdicional" class="btn-success" style="flex: 1;">Actualizar</button>
                <button id="btnCancelarFechaAdicional" style="flex: 1; background: #4a5a6a; color: white; border: none; border-radius: 6px; padding: 10px; cursor: pointer;">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnConfirmarFechaAdicional').addEventListener('click', function() {
        const fechaInput = document.getElementById('nuevaFechaRecibidoAdicional');
        const nuevaFecha = fechaInput.value;

        if (!nuevaFecha) {
            mostrarError('Campo incompleto', 'Por favor, selecciona una fecha');
            return;
        }

        const modalEl = document.getElementById('modalFechaRecibidoAdicional');
        if (modalEl) modalEl.remove();

        actualizarFechaRecibidoAdicional(index, nuevaFecha);
    });

    document.getElementById('btnCancelarFechaAdicional').addEventListener('click', function() {
        const modalEl = document.getElementById('modalFechaRecibidoAdicional');
        if (modalEl) modalEl.remove();
    });

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });

    setTimeout(() => {
        document.getElementById('nuevaFechaRecibidoAdicional').focus();
    }, 100);
}

async function actualizarFechaRecibidoAdicional(index, nuevaFecha) {
    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const envios = data.enviosDependencia || [];

        const realIndex = index + 1;

        if (realIndex >= envios.length || envios[realIndex].tipo !== 'envio_adicional') {
            mostrarError('Error', 'Envío no encontrado');
            return;
        }

        const fechaElaboracion = envios[realIndex].fechaElaboracion;
        if (fechaElaboracion && !fechaMenorOIgual(fechaElaboracion, nuevaFecha)) {
            mostrarError('Fecha inválida', 'La fecha de recibido no puede ser anterior a la fecha de elaboración');
            return;
        }

        envios[realIndex].fechaRecibido = nuevaFecha;

        await docRef.update({
            enviosDependencia: envios,
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Actualización de fecha de recibido (adicional)', 'Nueva fecha: ' + formatearFecha(nuevaFecha));

        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al actualizar', error.message);
    }
}

// ============ PASO 4: RESPUESTA DE DEPENDENCIA ============
function mostrarRespuestaDependencia() {
    const respuestas = ticketData.respuestasDependencia || [];
    const tieneRespuestaDep = respuestas.length > 0;

    const paso3Div = document.getElementById('paso3');
    const btnAgregar = document.getElementById('btnAgregarEnvioAdicional');

    if (tieneRespuestaDep) {
        if (paso3Div) paso3Div.style.display = 'none';
        if (btnAgregar) btnAgregar.style.display = 'none';
    } else {
        const enviosAdicionales = obtenerEnviosAdicionales();
        if (paso3Div) {
            paso3Div.style.display = 'block';
        }
        if (btnAgregar) {
            btnAgregar.style.display = 'inline-block';
        }
    }

    if (!tieneRespuestaDep) {
        document.getElementById('formRespuestaDependencia').style.display = 'block';
        document.getElementById('respuestaDependenciaRegistrada').style.display = 'none';

        const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
        let minFecha = fechaRecibido ? obtenerFechaStr(fechaRecibido) : '';
        const hoy = fechaHoy();

        if (!minFecha) minFecha = hoy;

        document.getElementById('fechaRespuestaDep').setAttribute('min', minFecha);
        document.getElementById('fechaRespuestaDep').setAttribute('max', hoy);

        return;
    }

    const ultimaRespuesta = respuestas[respuestas.length - 1];

    document.getElementById('formRespuestaDependencia').style.display = 'none';
    document.getElementById('respuestaDependenciaRegistrada').style.display = 'block';

    const fecha = new Date(ultimaRespuesta.fecha);
    const fechaResp = ultimaRespuesta.fechaRespuesta ? ultimaRespuesta.fechaRespuesta : null;

    document.getElementById('respuestaDependenciaData').innerHTML = `
        <p><strong>Descripción:</strong> ${ultimaRespuesta.descripcion}</p>
        <p><strong>Oficio:</strong> ${ultimaRespuesta.oficio}</p>
        <p><strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFechaSinHora(fechaResp) : 'N/A'}</p>
        <p><strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
        <p><strong>Registrado por:</strong> ${ultimaRespuesta.usuario}</p>
    `;

    if (ticketData.asunto !== 'no_procede') {
        mostrarPaso('paso5');
    }
}

async function registrarRespuestaDependencia() {
    if (!puedeAvanzar(4)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionRespuestaDep').value.trim();
    const oficio = document.getElementById('oficioRespuestaDep').value.trim();
    const fecha = document.getElementById('fechaRespuestaDep').value;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fecha) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campos incompletos', 'Por favor, completa todos los campos');
        return;
    }

    if (fecha > hoy) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de respuesta no puede ser futura');
        return;
    }

    const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
    if (fechaRecibido && !fechaMenorOIgual(fechaRecibido, fecha)) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de respuesta no puede ser anterior a la fecha de recibido en dependencia');
        return;
    }

    try {
        const respuesta = {
            fecha: new Date().toISOString(),
            fechaRespuesta: fecha,
            oficio: oficio,
            descripcion: descripcion,
            usuario: auth.currentUser.email,
            tipo: 'respuesta_dependencia'
        };

        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();

        const respuestasActuales = data.respuestasDependencia || [];
        respuestasActuales.push(respuesta);

        await docRef.update({
            respuestasDependencia: respuestasActuales,
            fechaRespuestaDependencia: new Date().toISOString(),
            estado: 'en_proceso',
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Respuesta de dependencia', 'Oficio: ' + oficio + ' - ' + descripcion);

        ocultarLoading(btn, textoOriginal);
        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al registrar', error.message);
    }
}

// ============ PASO 5: RESPUESTA AL CIUDADANO ============
function mostrarRespuestaCiudadano() {
    const respuestas = ticketData.respuestasCiudadano || [];
    if (respuestas.length === 0) {
        document.getElementById('formRespuestaCiudadano').style.display = 'block';
        document.getElementById('respuestaCiudadanoRegistrada').style.display = 'none';

        const respuestasDep = ticketData.respuestasDependencia || [];
        const ultimaRespDep = respuestasDep[respuestasDep.length - 1];
        let minFecha = ultimaRespDep && ultimaRespDep.fechaRespuesta ? obtenerFechaStr(ultimaRespDep.fechaRespuesta) : '';
        const hoy = fechaHoy();

        if (!minFecha) minFecha = hoy;

        document.getElementById('fechaRespuestaCiudadano').setAttribute('min', minFecha);
        document.getElementById('fechaRespuestaCiudadano').setAttribute('max', hoy);

        return;
    }

    const ultimaRespuesta = respuestas[respuestas.length - 1];

    document.getElementById('formRespuestaCiudadano').style.display = 'none';
    document.getElementById('respuestaCiudadanoRegistrada').style.display = 'block';

    const fecha = new Date(ultimaRespuesta.fecha);
    const fechaResp = ultimaRespuesta.fechaRespuesta ? ultimaRespuesta.fechaRespuesta : null;

    document.getElementById('respuestaCiudadanoData').innerHTML = `
        <p><strong>Descripción:</strong> ${ultimaRespuesta.descripcion}</p>
        <p><strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFechaSinHora(fechaResp) : 'N/A'}</p>
        <p><strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
        <p><strong>Registrado por:</strong> ${ultimaRespuesta.usuario}</p>
    `;

    if (ticketData.asunto !== 'no_procede') {
        mostrarPaso('paso6');
    }
}

async function registrarRespuestaCiudadano() {
    if (!puedeAvanzar(5)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionRespuestaCiudadano').value.trim();
    const fecha = document.getElementById('fechaRespuestaCiudadano').value;
    const hoy = fechaHoy();

    if (!descripcion || !fecha) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Campos incompletos', 'Por favor, completa todos los campos');
        return;
    }

    if (fecha > hoy) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de respuesta no puede ser futura');
        return;
    }

    const respuestasDep = ticketData.respuestasDependencia || [];
    const ultimaRespDep = respuestasDep[respuestasDep.length - 1];
    if (ultimaRespDep && ultimaRespDep.fechaRespuesta && !fechaMenorOIgual(ultimaRespDep.fechaRespuesta, fecha)) {
        ocultarLoading(btn, textoOriginal);
        mostrarError('Fecha inválida', 'La fecha de respuesta al ciudadano no puede ser anterior a la fecha de respuesta de la dependencia');
        return;
    }

    try {
        const respuesta = {
            fecha: new Date().toISOString(),
            fechaRespuesta: fecha,
            descripcion: descripcion,
            usuario: auth.currentUser.email,
            tipo: 'respuesta_ciudadano'
        };

        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();

        const respuestasActuales = data.respuestasCiudadano || [];
        respuestasActuales.push(respuesta);

        await docRef.update({
            respuestasCiudadano: respuestasActuales,
            fechaActualizacion: new Date().toISOString()
        });

        await agregarHistorial('Respuesta al ciudadano', descripcion);

        ocultarLoading(btn, textoOriginal);
        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al registrar', error.message);
    }
}

// ============ PASO 6: GENERAR REPORTE ============
async function generarReporte() {
    const respuestasCiudadano = ticketData.respuestasCiudadano || [];
    if (respuestasCiudadano.length === 0) {
        mostrarError('Paso incompleto', 'Primero debes registrar la respuesta al ciudadano (Paso 5)');
        return;
    }

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    try {
        if (ticketData.estado !== 'resuelto') {
            await db.collection('tickets').doc(ticketId).update({
                estado: 'resuelto',
                fechaResolucion: new Date().toISOString(),
                fechaActualizacion: new Date().toISOString()
            });
            await agregarHistorial('Ticket resuelto', 'Ticket resuelto');
            await cargarTicket();
        }

        await generarPDFReporte();

        ocultarLoading(btn, textoOriginal);

    } catch (error) {
        console.error('Error:', error);
        ocultarLoading(btn, textoOriginal);
        mostrarError('Error al generar reporte', error.message);
    }
}

// ============ GENERAR PDF DEL REPORTE ============
function generarPDFReporte() {
    return new Promise((resolve, reject) => {
        try {
            const t = ticketData;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            let y = margin;

            function checkPageBreak(alturaNecesaria) {
                if (y + alturaNecesaria > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            }

            function addLine(yPos, color = '#1a3a5c') {
                doc.setDrawColor(color);
                doc.setLineWidth(0.5);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                return yPos + 3;
            }

            function addSectionTitle(texto) {
                checkPageBreak(10);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(26, 58, 92);
                doc.text(texto, margin, y);
                y += 6;
            }

            // HEADER
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(26, 58, 92);
            doc.text('REPORTE DE SEGUIMIENTO', pageWidth / 2, y, { align: 'center' });
            y += 10;

            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Folio: ' + t.folio, pageWidth / 2, y, { align: 'center' });
            y += 7;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Generado: ' + new Date().toLocaleString('es-MX'), pageWidth / 2, y, { align: 'center' });
            y += 7;

            y = addLine(y);
            y += 5;

            // 1. DATOS GENERALES
            addSectionTitle('1. DATOS GENERALES');

            let diasHabilesLabel = 'No disponible';
            const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
            const respCiudadano = t.respuestasCiudadano || [];
            const ultimaRespCiudadano = respCiudadano.length > 0 ? respCiudadano[respCiudadano.length - 1] : null;
            const fechaRespuestaCiudadano = ultimaRespCiudadano ? (ultimaRespCiudadano.fechaRespuesta || ultimaRespCiudadano.fecha) : null;

            if (fechaRecibido && fechaRespuestaCiudadano) {
                const dias = calcularDiasHabiles(fechaRecibido, fechaRespuestaCiudadano);
                diasHabilesLabel = dias !== null ? dias + ' días hábiles' : 'No disponible';
            } else if (fechaRecibido) {
                const dias = calcularDiasHabiles(fechaRecibido, fechaHoy());
                diasHabilesLabel = dias !== null ? dias + ' días hábiles (en proceso)' : 'No disponible';
            }

            const depNombre = dependenciasList.find(d => d.id === t.dependencia)?.nombre || t.dependencia || 'Sin asignar';

            const datos = [
                ['Folio:', t.folio],
                ['Nombre:', t.nombre],
                ['Correo:', t.email || 'No proporcionado'],
                ['Teléfono:', t.telefono || 'No proporcionado'],
                ['Asunto:', t.asunto || 'Sin clasificar'],
                ['Dependencia:', depNombre],
                ['Estado:', 'RESUELTO'],
                ['Fecha creación:', formatearFechaHora(t.fechaCreacion)],
                ['Fecha resolución:', t.fechaResolucion ? formatearFechaHora(t.fechaResolucion) : new Date().toLocaleString('es-MX')],
                ['Días hábiles:', diasHabilesLabel]
            ];

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            datos.forEach(([label, value]) => {
                checkPageBreak(6);
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'bold');
                doc.text(label, margin, y);
                const labelWidth = doc.getTextWidth(label);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50, 50, 50);
                doc.text(String(value), margin + labelWidth + 3, y);
                y += 5;
            });
            y += 3;

            checkPageBreak(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('Mensaje del usuario:', margin, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50, 50, 50);
            const mensajeLines = doc.splitTextToSize(t.mensaje || 'Sin mensaje', pageWidth - (margin * 2));
            checkPageBreak(mensajeLines.length * 4);
            doc.text(mensajeLines, margin, y);
            y += mensajeLines.length * 4 + 5;

            y = addLine(y);
            y += 5;

            // 2. ENVÍO A DEPENDENCIA (PRINCIPAL)
            const envios = t.enviosDependencia || [];
            const envioPrincipal = envios.length > 0 ? envios[0] : null;

            if (envioPrincipal) {
                addSectionTitle('2. ENVÍO A DEPENDENCIA (PRINCIPAL)');

                const fechaElab = envioPrincipal.fechaElaboracion ? formatearFecha(envioPrincipal.fechaElaboracion) : 'N/A';
                const fechaRec = envioPrincipal.fechaRecibido ? formatearFecha(envioPrincipal.fechaRecibido) : 'No registrado';

                const descLinesPrincipal = doc.splitTextToSize('Descripción: ' + envioPrincipal.descripcion, pageWidth - (margin * 2) - 3);
                checkPageBreak(4 + 4 + (descLinesPrincipal.length * 4) + 4 + 4);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text('Envío inicial - ' + formatearFechaHora(envioPrincipal.fecha), margin, y);
                y += 4;

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50, 50, 50);
                doc.text('Oficio: ' + envioPrincipal.oficio, margin + 3, y);
                y += 4;

                doc.text(descLinesPrincipal, margin + 3, y);
                y += descLinesPrincipal.length * 4;

                doc.setTextColor(100, 100, 100);
                doc.setFontSize(9);
                doc.text('Elaboración: ' + fechaElab + ' | Recibido: ' + fechaRec, margin + 3, y);
                y += 4;
                doc.text('Registrado por: ' + envioPrincipal.usuario, margin + 3, y);
                y += 5;
            }

            // 2.1 ENVÍOS ADICIONALES
            const enviosAdicionales = envios.length > 1 ? envios.slice(1) : [];
            if (enviosAdicionales.length > 0) {
                y += 2;
                addSectionTitle('2.1 ENVÍOS ADICIONALES A DEPENDENCIA');

                enviosAdicionales.forEach((envio, index) => {
                    const fechaElab = envio.fechaElaboracion ? formatearFecha(envio.fechaElaboracion) : 'N/A';
                    const fechaRec = envio.fechaRecibido ? formatearFecha(envio.fechaRecibido) : 'No registrado';
                    const descLines = doc.splitTextToSize('Descripción: ' + envio.descripcion, pageWidth - (margin * 2) - 3);

                    checkPageBreak(4 + 4 + (descLines.length * 4) + 4 + 4);

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Envío adicional #' + (index + 1) + ' - ' + formatearFechaHora(envio.fecha), margin, y);
                    y += 4;

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text('Oficio: ' + envio.oficio, margin + 3, y);
                    y += 4;

                    doc.text(descLines, margin + 3, y);
                    y += descLines.length * 4;

                    doc.setTextColor(100, 100, 100);
                    doc.setFontSize(9);
                    doc.text('Elaboración: ' + fechaElab + ' | Recibido: ' + fechaRec, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + envio.usuario, margin + 3, y);
                    y += 5;
                });
            }

            y = addLine(y);
            y += 5;

            // 3. RESPUESTAS DE DEPENDENCIA
            const respuestasDep = t.respuestasDependencia || [];
            if (respuestasDep.length > 0) {
                addSectionTitle('3. RESPUESTAS DE DEPENDENCIA');

                respuestasDep.forEach((resp, index) => {
                    const fechaResp = resp.fechaRespuesta ? formatearFecha(resp.fechaRespuesta) : 'N/A';
                    const descLines = doc.splitTextToSize('Descripción: ' + resp.descripcion, pageWidth - (margin * 2) - 3);

                    checkPageBreak(4 + (descLines.length * 4) + 4 + 4);

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Respuesta #' + (index + 1) + ' - ' + formatearFechaHora(resp.fecha), margin, y);
                    y += 4;

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text('Oficio: ' + resp.oficio, margin + 3, y);
                    y += 4;

                    doc.text(descLines, margin + 3, y);
                    y += descLines.length * 4;

                    doc.setTextColor(100, 100, 100);
                    doc.setFontSize(9);
                    doc.text('Fecha de respuesta: ' + fechaResp, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + resp.usuario, margin + 3, y);
                    y += 5;
                });
                y += 2;
            }

            y = addLine(y);
            y += 5;

            // 4. RESPUESTAS AL CIUDADANO
            const respuestasCiudadanoList = t.respuestasCiudadano || [];
            if (respuestasCiudadanoList.length > 0) {
                addSectionTitle('4. RESPUESTAS AL CIUDADANO');

                respuestasCiudadanoList.forEach((resp, index) => {
                    const fechaResp = resp.fechaRespuesta ? formatearFecha(resp.fechaRespuesta) : 'N/A';
                    const descLines = doc.splitTextToSize('Descripción: ' + resp.descripcion, pageWidth - (margin * 2) - 3);

                    checkPageBreak((descLines.length * 4) + 4 + 4 + 4);

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Respuesta #' + (index + 1) + ' - registrada el ' + formatearFechaHora(resp.fecha), margin, y);
                    y += 4;

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text(descLines, margin, y);
                    y += descLines.length * 4;

                    doc.setTextColor(100, 100, 100);
                    doc.setFontSize(9);
                    doc.text('Fecha de respuesta: ' + fechaResp, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + resp.usuario, margin + 3, y);
                    y += 5;
                });
                y += 2;
            }

            // FOOTER
            checkPageBreak(12);
            y = addLine(y, '#cccccc');
            y += 3;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Reporte generado automáticamente el ' + new Date().toLocaleString('es-MX'), pageWidth / 2, y, { align: 'center' });
            y += 4;
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(8);
            doc.text('Sistema de Seguimiento de Tickets', pageWidth / 2, y, { align: 'center' });

            doc.save('reporte-' + t.folio + '-' + new Date().getTime() + '.pdf');
            resolve();

        } catch (error) {
            console.error('Error al generar PDF:', error);
            reject(error);
        }
    });
}

// ============ CONTADOR DE DÍAS HÁBILES ============
function actualizarContadorDias() {
    const contadorDiv = document.getElementById('diasContador');
    const alertaDiv = document.getElementById('alertasVencimiento');
    const paso3Div = document.getElementById('paso3');

    if (ticketData.asunto === 'no_procede' || ticketData.estado === 'cerrado' || ticketData.estado === 'resuelto') {
        contadorDiv.innerHTML = '<p style="color: #7a8a9a;">Ticket cerrado o resuelto</p>';
        alertaDiv.style.display = 'none';
        if (paso3Div) paso3Div.style.display = 'none';
        return;
    }

    const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
    if (!fechaRecibido) {
        contadorDiv.innerHTML = `
            <div style="background: #fcf3e0; padding: 15px; border-radius: 8px;">
                <p><strong>No se puede contar días hábiles</strong></p>
                <p>La fecha de recibido en dependencia no está registrada.</p>
                <p>Por favor, actualiza la fecha de recibido para comenzar el conteo.</p>
            </div>
        `;
        alertaDiv.style.display = 'none';
        if (paso3Div) paso3Div.style.display = 'none';
        return;
    }

    const diasHabiles = calcularDiasHabiles(fechaRecibido, fechaHoy());
    diasHabilesTranscurridos = diasHabiles;

    const diasClass = diasHabiles < 10 ? 'ok' : (diasHabiles < 15 ? 'warning' : 'danger');

    contadorDiv.innerHTML = `
        <div class="dias-box">
            <p><strong>Fecha de recibido (primer envío):</strong> ${formatearFecha(fechaRecibido)}</p>
            <p><strong>Días hábiles transcurridos:</strong> <span class="dias-number ${diasClass}">${diasHabiles}</span></p>
            <p><strong>Límite:</strong> 10 días hábiles</p>
            ${diasHabiles < 10 ? '<p><strong>Días restantes:</strong> ' + (10 - diasHabiles) + '</p>' : ''}
        </div>
    `;

    if (diasHabiles >= 10) {
        alertaDiv.style.display = 'block';
        document.getElementById('mensajeVencimiento').textContent =
            'Este ticket tiene ' + diasHabiles + ' días hábiles sin respuesta. Se recomienda enviar un nuevo oficio.';

        if (paso3Div) paso3Div.style.display = 'block';

        if (ticketData.estado !== 'vencido' && ticketData.estado !== 'resuelto' && ticketData.estado !== 'cerrado') {
            db.collection('tickets').doc(ticketId).update({
                estado: 'vencido',
                fechaActualizacion: new Date().toISOString()
            }).then(() => {
                cargarTicket();
            }).catch(err => console.error('Error al actualizar estado:', err));
        }
    } else {
        alertaDiv.style.display = 'none';
        const respuestasDep = ticketData.respuestasDependencia || [];
        if (respuestasDep.length === 0 && paso3Div) {
            paso3Div.style.display = 'none';
        }
    }
}

// ============ HISTORIAL ============
async function agregarHistorial(accion, descripcion) {
    try {
        const historialEntry = {
            fecha: new Date().toISOString(),
            accion: accion,
            descripcion: descripcion || '',
            usuario: auth.currentUser.email
        };

        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();

        const historialActual = data.historialSeguimiento || [];
        historialActual.push(historialEntry);

        await docRef.update({
            historialSeguimiento: historialActual
        });

    } catch (error) {
        console.error('Error al agregar historial:', error);
    }
}

function cargarHistorial() {
    const container = document.getElementById('historialContainer');
    const historial = ticketData.historialSeguimiento || [];

    if (historial.length === 0) {
        container.innerHTML = '<p style="color: #7a8a9a;">Sin historial de seguimiento</p>';
        return;
    }

    let html = '';
    historial.forEach(h => {
        const fecha = new Date(h.fecha);
        html += `
            <div class="historial-item">
                <p><strong><i class="fas fa-tag"></i> ${h.accion}</strong></p>
                <p><i class="fas fa-clock"></i> <strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
                <p><i class="fas fa-user"></i> <strong>Por:</strong> ${h.usuario || 'N/A'}</p>
                ${h.descripcion ? `<p><i class="fas fa-info-circle"></i> ${h.descripcion}</p>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============ ACTUALIZAR CONTADOR ============
setInterval(() => {
    if (ticketData && ticketData.asunto !== 'no_procede' &&
        ticketData.estado !== 'cerrado' && ticketData.estado !== 'resuelto') {
        actualizarContadorDias();
    }
}, 60000);

console.log('✅ seguimiento.js cargado correctamente');