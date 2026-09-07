// ============ VARIABLES GLOBALES ============
let ticketId = null;
let ticketData = null;
let diasHabilesTranscurridos = 0;

// ============ OBTENER ID DEL TICKET ============
const urlParams = new URLSearchParams(window.location.search);
ticketId = urlParams.get('id');

if (!ticketId) {
    alert('No se especificó un ticket');
    window.location.href = 'admin.html';
}

// ============ VERIFICAR AUTENTICACIÓN ============
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('userEmail').textContent = user.email;
        cargarTicket();
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

// Fecha de "hoy" en horario LOCAL como string YYYY-MM-DD.
// new Date().toISOString() usa UTC y puede adelantar/atrasar un día
// completo en husos horarios como el de México — por eso NO se usa aquí.
function fechaHoy() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Convierte una fecha (Timestamp, string "YYYY-MM-DD", string ISO o Date) a un
// objeto Date interpretado en horario LOCAL cuando es una fecha sin hora.
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

function compararFechas(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return true;
    const d1 = parseFechaLocal(fecha1);
    const d2 = parseFechaLocal(fecha2);
    return d1 <= d2;
}

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
        const dd = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dd}`;

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !diasFestivos.includes(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// ============ HELPERS: ENVÍO PRINCIPAL VS. ENVÍOS ADICIONALES ============
// El envío principal (Paso 5) es SIEMPRE envios[0]: el primero que se registra.
// Todo lo que se agregue después (Paso 6) son envíos adicionales y NUNCA deben
// mezclarse ni modificar la información del envío principal.
function obtenerEnvioPrincipal() {
    const envios = ticketData.enviosDependencia || [];
    return envios.length > 0 ? envios[0] : null;
}

function obtenerEnviosAdicionales() {
    const envios = ticketData.enviosDependencia || [];
    return envios.length > 1 ? envios.slice(1) : [];
}

// ============ OBTENER FECHA DE RECIBIDO DEL PRIMER ENVÍO ============
function obtenerFechaRecibidoPrimerEnvio() {
    const principal = obtenerEnvioPrincipal();
    return principal ? (principal.fechaRecibido || null) : null;
}

// ============ MOSTRAR LOADING ============
function mostrarLoading(btn) {
    const textoOriginal = btn.textContent;
    btn.textContent = 'Procesando...';
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
            alert('Ticket no encontrado');
            window.location.href = 'admin.html';
            return;
        }

        ticketData = { id: doc.id, ...doc.data() };
        mostrarTicket();

    } catch (error) {
        console.error('Error al cargar ticket:', error);
        alert('Error al cargar el ticket');
    }
}

// ============ VERIFICAR SI SE PUEDE AVANZAR ============
function puedeAvanzar(pasoRequerido) {
    if (ticketData.estado === 'cerrado' && ticketData.asunto === 'no_procede') {
        alert('Este ticket fue cerrado como "No procede"');
        return false;
    }

    const paso = pasoRequerido || 0;

    switch (paso) {
        case 5:
            if (ticketData.asunto === 'pendiente_clasificar' || !ticketData.dependencia || ticketData.dependencia === 'sin_asignar') {
                alert('Primero debes clasificar el asunto y asignar dependencia (Paso 4)');
                return false;
            }
            break;
        case 6:
            if (!ticketData.enviosDependencia || ticketData.enviosDependencia.length === 0) {
                alert('Primero debes registrar el envío a dependencia (Paso 5)');
                return false;
            }
            break;
        case 7:
            if (!ticketData.enviosDependencia || ticketData.enviosDependencia.length === 0) {
                alert('Primero debes registrar el envío a dependencia (Paso 5)');
                return false;
            }
            // Verificar que el PRIMER envío tenga fecha de recibido
            const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
            if (!fechaRecibido) {
                alert('Debes actualizar la fecha de recibido del primer envío antes de continuar');
                return false;
            }
            break;
        case 8:
            if (!ticketData.respuestasDependencia || ticketData.respuestasDependencia.length === 0) {
                alert('Primero debes registrar la respuesta de la dependencia (Paso 7)');
                return false;
            }
            break;
        case 9:
            if (!ticketData.respuestasCiudadano || ticketData.respuestasCiudadano.length === 0) {
                alert('Primero debes registrar la respuesta al ciudadano (Paso 8)');
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

    document.getElementById('asuntoTicket').value = t.asunto || 'pendiente_clasificar';
    document.getElementById('dependenciaTicket').value = t.dependencia || 'sistemas';

    if (t.asunto === 'no_procede') {
        document.getElementById('dependenciaTicket').disabled = true;
        ocultarPasos(true);
        return;
    } else {
        document.getElementById('dependenciaTicket').disabled = false;
    }

    mostrarPaso4();
    mostrarEnvioDependencia();
    mostrarRespuestaDependencia();
    mostrarRespuestaCiudadano();
    cargarHistorial();
    actualizarContadorDias();
    cargarEnviosAdicionales();
}

// ============ OCULTAR/MOSTRAR PASOS ============
function ocultarPasos(ocultar) {
    const pasos = ['paso5', 'paso6', 'paso7', 'paso8', 'paso9', 'contadorDias'];
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

// ============ PASO 4: MOSTRAR ============
function mostrarPaso4() {
    const t = ticketData;
    const tieneDatos = t.asunto && t.asunto !== 'pendiente_clasificar' && t.dependencia && t.dependencia !== 'sin_asignar';

    if (tieneDatos) {
        document.getElementById('formPaso4').style.display = 'none';
        document.getElementById('paso4Registrado').style.display = 'block';

        const asuntoLabel = {
            'queja': 'Queja',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'otros': 'Otros',
            'no_procede': 'No procede'
        }[t.asunto] || t.asunto;

        document.getElementById('paso4Data').innerHTML = `
            <p><strong>Asunto:</strong> ${asuntoLabel}</p>
            <p><strong>Dependencia:</strong> ${t.dependencia || 'Sin asignar'}</p>
            <p><strong>Estado:</strong> ${t.estado}</p>
        `;

        if (t.asunto !== 'no_procede') {
            mostrarPaso('paso5');
        }
    } else {
        ocultarPasos(true);
        document.getElementById('paso5').style.display = 'none';
    }
}

// ============ PASO 4: ACTUALIZAR ============
async function actualizarDatosTicket() {
    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const asunto = document.getElementById('asuntoTicket').value;
    const dependencia = document.getElementById('dependenciaTicket').value;

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
            alert('Error al actualizar: ' + error.message);
            ocultarLoading(btn, textoOriginal);
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

        await agregarHistorial('Actualización de datos', 'Asunto: ' + asunto + ', Dependencia: ' + dependencia);

        ocultarLoading(btn, textoOriginal);
        cargarTicket();

    } catch (error) {
        console.error('Error al actualizar:', error);
        alert('Error al actualizar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

// ============ PASO 5: MOSTRAR ENVÍO ============
// Solo debe mostrar/actualizar el envío PRINCIPAL (envios[0]). Los envíos
// adicionales se muestran aparte en el Paso 6 (cargarEnviosAdicionales) y
// jamás deben sobreescribir esta sección.
function mostrarEnvioDependencia() {
    const envioPrincipal = obtenerEnvioPrincipal();

    if (!envioPrincipal) {
        document.getElementById('formEnvioDependencia').style.display = 'block';
        document.getElementById('envioDependenciaRegistrado').style.display = 'none';

        const fechaCreacion = ticketData.fechaCreacion;
        const hoy = fechaHoy();
        const minFecha = fechaCreacion ? new Date(fechaCreacion).toISOString().split('T')[0] : '';

        const fechaElabInput = document.getElementById('fechaElaboracion');
        const fechaRecInput = document.getElementById('fechaRecibidoDependencia');

        fechaElabInput.setAttribute('min', minFecha);
        fechaElabInput.setAttribute('max', hoy);
        fechaRecInput.setAttribute('max', hoy);
        fechaRecInput.setAttribute('min', minFecha);

        // Evitar acumular listeners duplicados cada vez que se vuelve a
        // renderizar esta sección (por ejemplo tras recargar el ticket).
        if (!fechaElabInput.dataset.listenerAttached) {
            fechaElabInput.addEventListener('change', function() {
                const fechaElab = this.value;
                const fechaRecibido = fechaRecInput.value;
                if (fechaRecibido && fechaElab && !compararFechas(fechaElab, fechaRecibido)) {
                    fechaRecInput.value = '';
                    fechaRecInput.style.borderColor = '#dc2626';
                } else if (fechaRecibido && fechaElab) {
                    fechaRecInput.style.borderColor = '';
                }
            });
            fechaElabInput.dataset.listenerAttached = 'true';
        }

        if (!fechaRecInput.dataset.listenerAttached) {
            fechaRecInput.addEventListener('change', function() {
                const fechaRecibido = this.value;
                const fechaElab = fechaElabInput.value;
                if (fechaRecibido && fechaElab && !compararFechas(fechaElab, fechaRecibido)) {
                    this.value = '';
                    this.style.borderColor = '#dc2626';
                    alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
                } else if (fechaRecibido && fechaElab) {
                    this.style.borderColor = '';
                }
            });
            fechaRecInput.dataset.listenerAttached = 'true';
        }

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
        mostrarPaso('paso7');
        mostrarPaso('contadorDias');
    }
}

// ============ PASO 5: ACTUALIZAR FECHA DE RECIBIDO ============
function editarFechaRecibido() {
    const envioPrincipal = obtenerEnvioPrincipal();
    if (!envioPrincipal) {
        alert('No hay envío principal registrado');
        return;
    }

    const fechaElaboracion = envioPrincipal.fechaElaboracion || '';
    const hoy = fechaHoy();

    const modal = document.createElement('div');
    modal.id = 'modalFechaRecibido';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; justify-content: center;
        align-items: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h3 style="margin-bottom: 20px;">Actualizar fecha de recibido</h3>
            <div class="form-group">
                <label>Nueva fecha de recibido *</label>
                <input type="date" id="nuevaFechaRecibido" 
                       min="${fechaElaboracion}" max="${hoy}"
                       style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;">
                <small style="color: #666; display: block; margin-top: 4px;">La fecha debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)}) y no puede ser futura</small>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="btnConfirmarFecha" class="btn-success" style="flex: 1;">Actualizar</button>
                <button id="btnCancelarFecha" style="flex: 1; background: #6c757d; color: white;">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnConfirmarFecha').addEventListener('click', function() {
        const fechaInput = document.getElementById('nuevaFechaRecibido');
        const nuevaFecha = fechaInput.value;

        if (!nuevaFecha) {
            alert('Por favor, selecciona una fecha');
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

// Actualiza SOLAMENTE envios[0] (el principal). Nunca toca envíos adicionales.
async function actualizarFechaRecibido(nuevaFecha) {
    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const envios = data.enviosDependencia || [];

        if (envios.length === 0) {
            alert('No se encontró el envío principal');
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
        alert('Error al actualizar: ' + error.message);
    }
}

// ============ PASO 5: REGISTRAR ENVÍO ============
async function registrarEnvioDependencia() {
    if (!puedeAvanzar(5)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionEnvio').value.trim();
    const oficio = document.getElementById('oficioEnvio').value.trim();
    const fechaElaboracion = document.getElementById('fechaElaboracion').value;
    const fechaRecibido = document.getElementById('fechaRecibidoDependencia').value || null;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fechaElaboracion) {
        alert('Por favor, completa todos los campos obligatorios');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    // Validaciones
    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = new Date(fechaCreacion).toISOString().split('T')[0];
        if (!compararFechas(fechaCreacionStr, fechaElaboracion)) {
            alert('La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }

    if (fechaElaboracion > hoy) {
        alert('La fecha de elaboración no puede ser futura');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    if (fechaRecibido) {
        if (fechaRecibido > hoy) {
            alert('La fecha de recibido no puede ser futura');
            ocultarLoading(btn, textoOriginal);
            return;
        }
        if (!compararFechas(fechaElaboracion, fechaRecibido)) {
            alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }

    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const enviosActuales = data.enviosDependencia || [];

        // Este flujo (Paso 5) SOLO debe ejecutarse cuando todavía no existe
        // ningún envío principal. Si ya existe uno, se detiene para no
        // duplicarlo ni afectarlo — los envíos posteriores deben ir siempre
        // por "registrarEnvioAdicional" (Paso 6).
        if (enviosActuales.length > 0) {
            alert('Ya existe un envío principal registrado para este ticket. Usa "Agregar otro envío" (Paso 6) para envíos adicionales.');
            ocultarLoading(btn, textoOriginal);
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
            tipo: 'envio_dependencia' // Este es el principal
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
        alert('Error al registrar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

// ============ PASO 6: ENVÍOS ADICIONALES ============
function agregarEnvioAdicional() {
    if (!puedeAvanzar(6)) return;

    const container = document.getElementById('enviosAdicionalesContainer');
    const hoy = fechaHoy();
    const fechaCreacion = ticketData.fechaCreacion;
    const minFecha = fechaCreacion ? new Date(fechaCreacion).toISOString().split('T')[0] : '';

    // Obtener la fecha de recibido del PRIMER envío (principal) para calcular
    // 10 días hábiles después. Un envío adicional nunca debe usar la fecha
    // de otro envío adicional como referencia.
    const primerEnvio = obtenerEnvioPrincipal();
    let fechaMinimaAdicional = minFecha;

    if (primerEnvio && primerEnvio.fechaRecibido) {
        const fechaRecibido = parseFechaLocal(primerEnvio.fechaRecibido);
        let dias = 0;
        const temp = new Date(fechaRecibido);
        while (dias < 10) {
            temp.setDate(temp.getDate() + 1);
            const dayOfWeek = temp.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                dias++;
            }
        }
        const y = temp.getFullYear();
        const m = String(temp.getMonth() + 1).padStart(2, '0');
        const d = String(temp.getDate()).padStart(2, '0');
        fechaMinimaAdicional = `${y}-${m}-${d}`;
    }

    const div = document.createElement('div');
    div.className = 'envio-adicional';
    div.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #17a2b8;">
            <h4>Envío adicional #${container.querySelectorAll('.envio-adicional').length + 1}</h4>
            <div class="form-row">
                <div class="form-group full-width">
                    <label>Descripción *</label>
                    <textarea class="desc-adicional" rows="4" placeholder="Describe el envío..."></textarea>
                </div>
                <div class="form-group">
                    <label>Oficio *</label>
                    <input class="oficio-adicional" type="text" placeholder="Ej: OF-2026-002">
                </div>
                <div class="form-group">
                    <label>Fecha elaboración *</label>
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
            <button onclick="this.parentElement.remove()" style="background: #dc3545; margin-top: 10px; margin-left: 10px; color: white;">Eliminar</button>
        </div>
    `;

    // Event listeners para validación de fechas en envío adicional
    const fechaElabInput = div.querySelector('.fecha-elaboracion-adicional');
    const fechaRecInput = div.querySelector('.fecha-recibido-adicional');

    fechaElabInput.addEventListener('change', function() {
        const fechaElab = this.value;
        const fechaRec = fechaRecInput.value;
        if (fechaRec && fechaElab && !compararFechas(fechaElab, fechaRec)) {
            fechaRecInput.value = '';
            fechaRecInput.style.borderColor = '#dc2626';
        } else if (fechaRec && fechaElab) {
            fechaRecInput.style.borderColor = '';
        }
    });

    fechaRecInput.addEventListener('change', function() {
        const fechaRec = this.value;
        const fechaElab = fechaElabInput.value;
        if (fechaRec && fechaElab && !compararFechas(fechaElab, fechaRec)) {
            this.value = '';
            this.style.borderColor = '#dc2626';
            alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
        } else if (fechaRec && fechaElab) {
            this.style.borderColor = '';
        }
    });

    container.appendChild(div);
}

// Este flujo SOLO agrega un elemento nuevo al final del arreglo
// enviosDependencia. NUNCA lee, modifica ni sobreescribe envios[0]
// (el envío principal del Paso 5) — así se evita el bug donde registrar
// un envío adicional alteraba la información del Paso 5.
async function registrarEnvioAdicional(btn) {
    const textoOriginal = mostrarLoading(btn);
    const parent = btn.parentElement;
    const descripcion = parent.querySelector('.desc-adicional').value.trim();
    const oficio = parent.querySelector('.oficio-adicional').value.trim();
    const fechaElaboracion = parent.querySelector('.fecha-elaboracion-adicional').value;
    const fechaRecibido = parent.querySelector('.fecha-recibido-adicional').value || null;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fechaElaboracion) {
        alert('Por favor, completa todos los campos obligatorios');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    // Validaciones
    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = new Date(fechaCreacion).toISOString().split('T')[0];
        if (!compararFechas(fechaCreacionStr, fechaElaboracion)) {
            alert('La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }

    if (fechaElaboracion > hoy) {
        alert('La fecha de elaboración no puede ser futura');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    if (fechaRecibido) {
        if (fechaRecibido > hoy) {
            alert('La fecha de recibido no puede ser futura');
            ocultarLoading(btn, textoOriginal);
            return;
        }
        if (!compararFechas(fechaElaboracion, fechaRecibido)) {
            alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }

    if (!puedeAvanzar(6)) {
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
            alert('No existe un envío principal (Paso 5) registrado todavía.');
            ocultarLoading(btn, textoOriginal);
            return;
        }

        // Solo se agrega al final; envios[0] (principal) queda intacto.
        enviosActuales.push(envio);

        await docRef.update({
            enviosDependencia: enviosActuales,
            fechaActualizacion: new Date().toISOString()
            // Nota: a propósito NO se toca "estado" ni "fechaEnvioDependencia"
            // aquí, porque esos campos pertenecen al envío principal (Paso 5).
        });

        await agregarHistorial('Envío adicional a dependencia', 'Oficio: ' + oficio + ' - ' + descripcion);

        ocultarLoading(btn, textoOriginal);
        parent.remove();
        cargarTicket();

    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

function cargarEnviosAdicionales() {
    const container = document.getElementById('enviosAdicionalesContainer');
    const adicionales = obtenerEnviosAdicionales();

    const paso6 = document.getElementById('paso6');
    if (adicionales.length > 0) {
        paso6.style.display = 'block';
    }

    if (adicionales.length === 0) {
        container.innerHTML = '<p style="color: #999;">No hay envíos adicionales</p>';
        return;
    }

    let html = '';
    adicionales.forEach((envio, index) => {
        const fecha = new Date(envio.fecha);
        const fechaElab = envio.fechaElaboracion ? envio.fechaElaboracion : null;
        const fechaRec = envio.fechaRecibido ? envio.fechaRecibido : null;

        const tieneFechaRecibido = !!envio.fechaRecibido;

        html += `
            <div class="envio-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #17a2b8;">
                <p><strong>Envío adicional #${index + 1}</strong> - ${formatearFechaHora(fecha)}</p>
                <p><strong>Oficio:</strong> ${envio.oficio}</p>
                <p><strong>Descripción:</strong> ${envio.descripcion}</p>
                <p><small>Elaboración: ${fechaElab ? formatearFecha(fechaElab) : 'N/A'} | Recibido: ${fechaRec ? formatearFecha(fechaRec) : 'No registrado'}</small></p>
                <p><small>Por: ${envio.usuario}</small></p>
                ${!tieneFechaRecibido ? `<button onclick="editarFechaRecibidoAdicional('${index}')" class="btn-secondary" style="margin-top: 5px; font-size: 12px;">Actualizar fecha de recibido</button>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============ ACTUALIZAR FECHA DE RECIBIDO PARA ENVÍO ADICIONAL ============
function editarFechaRecibidoAdicional(index) {
    const adicionales = obtenerEnviosAdicionales();

    if (index >= adicionales.length) {
        alert('Envío no encontrado');
        return;
    }

    const envio = adicionales[index];
    const fechaElaboracion = envio.fechaElaboracion || '';
    const hoy = fechaHoy();

    const modal = document.createElement('div');
    modal.id = 'modalFechaRecibidoAdicional';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; justify-content: center;
        align-items: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h3 style="margin-bottom: 20px;">Actualizar fecha de recibido</h3>
            <div class="form-group">
                <label>Nueva fecha de recibido *</label>
                <input type="date" id="nuevaFechaRecibidoAdicional" 
                       min="${fechaElaboracion}" max="${hoy}"
                       style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;">
                <small style="color: #666; display: block; margin-top: 4px;">La fecha debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)}) y no puede ser futura</small>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="btnConfirmarFechaAdicional" class="btn-success" style="flex: 1;">Actualizar</button>
                <button id="btnCancelarFechaAdicional" style="flex: 1; background: #6c757d; color: white;">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnConfirmarFechaAdicional').addEventListener('click', function() {
        const fechaInput = document.getElementById('nuevaFechaRecibidoAdicional');
        const nuevaFecha = fechaInput.value;

        if (!nuevaFecha) {
            alert('Por favor, selecciona una fecha');
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

// Actualiza únicamente el envío adicional correspondiente (nunca envios[0]).
async function actualizarFechaRecibidoAdicional(index, nuevaFecha) {
    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        const envios = data.enviosDependencia || [];

        // Los envíos adicionales viven a partir del índice 1 en adelante.
        const realIndex = index + 1;

        if (realIndex >= envios.length || envios[realIndex].tipo !== 'envio_adicional') {
            alert('Envío no encontrado');
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
        alert('Error al actualizar: ' + error.message);
    }
}

// ============ PASO 7: RESPUESTA DE DEPENDENCIA ============
function mostrarRespuestaDependencia() {
    const respuestas = ticketData.respuestasDependencia || [];
    if (respuestas.length === 0) {
        document.getElementById('formRespuestaDependencia').style.display = 'block';
        document.getElementById('respuestaDependenciaRegistrada').style.display = 'none';

        const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
        const minFecha = fechaRecibido || '';
        const hoy = fechaHoy();

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
        mostrarPaso('paso8');
    }
}

async function registrarRespuestaDependencia() {
    if (!puedeAvanzar(7)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionRespuestaDep').value.trim();
    const oficio = document.getElementById('oficioRespuestaDep').value.trim();
    const fecha = document.getElementById('fechaRespuestaDep').value;
    const hoy = fechaHoy();

    if (!descripcion || !oficio || !fecha) {
        alert('Por favor, completa todos los campos');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    if (fecha > hoy) {
        alert('La fecha de respuesta no puede ser futura');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
    if (fechaRecibido && !compararFechas(fechaRecibido, fecha)) {
        alert('La fecha de respuesta no puede ser anterior a la fecha de recibido en dependencia');
        ocultarLoading(btn, textoOriginal);
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
        alert('Error al registrar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

// ============ PASO 8: RESPUESTA AL CIUDADANO ============
function mostrarRespuestaCiudadano() {
    const respuestas = ticketData.respuestasCiudadano || [];
    if (respuestas.length === 0) {
        document.getElementById('formRespuestaCiudadano').style.display = 'block';
        document.getElementById('respuestaCiudadanoRegistrada').style.display = 'none';

        const respuestasDep = ticketData.respuestasDependencia || [];
        const ultimaRespDep = respuestasDep[respuestasDep.length - 1];
        const minFecha = ultimaRespDep && ultimaRespDep.fechaRespuesta ? ultimaRespDep.fechaRespuesta : '';
        const hoy = fechaHoy();

        document.getElementById('fechaRespuestaCiudadano').setAttribute('min', minFecha);
        document.getElementById('fechaRespuestaCiudadano').setAttribute('max', hoy);

        return;
    }

    const ultimaRespuesta = respuestas[respuestas.length - 1];

    document.getElementById('formRespuestaCiudadano').style.display = 'none';
    document.getElementById('respuestaCiudadanoRegistrada').style.display = 'block';

    const fecha = new Date(ultimaRespuesta.fecha);
    // La fecha de respuesta al ciudadano NUNCA lleva hora: solo se captura el día.
    const fechaResp = ultimaRespuesta.fechaRespuesta ? ultimaRespuesta.fechaRespuesta : null;

    document.getElementById('respuestaCiudadanoData').innerHTML = `
        <p><strong>Descripción:</strong> ${ultimaRespuesta.descripcion}</p>
        <p><strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFechaSinHora(fechaResp) : 'N/A'}</p>
        <p><strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
        <p><strong>Registrado por:</strong> ${ultimaRespuesta.usuario}</p>
    `;

    if (ticketData.asunto !== 'no_procede') {
        mostrarPaso('paso9');
    }
}

async function registrarRespuestaCiudadano() {
    if (!puedeAvanzar(8)) return;

    const btn = event.target;
    const textoOriginal = mostrarLoading(btn);

    const descripcion = document.getElementById('descripcionRespuestaCiudadano').value.trim();
    const fecha = document.getElementById('fechaRespuestaCiudadano').value;
    const hoy = fechaHoy();

    if (!descripcion || !fecha) {
        alert('Por favor, completa todos los campos');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    if (fecha > hoy) {
        alert('La fecha de respuesta no puede ser futura');
        ocultarLoading(btn, textoOriginal);
        return;
    }

    const respuestasDep = ticketData.respuestasDependencia || [];
    const ultimaRespDep = respuestasDep[respuestasDep.length - 1];
    if (ultimaRespDep && ultimaRespDep.fechaRespuesta && !compararFechas(ultimaRespDep.fechaRespuesta, fecha)) {
        alert('La fecha de respuesta al ciudadano no puede ser anterior a la fecha de respuesta de la dependencia');
        ocultarLoading(btn, textoOriginal);
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
        alert('Error al registrar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

// ============ PASO 9: GENERAR REPORTE ============
async function generarReporte() {
    const respuestasCiudadano = ticketData.respuestasCiudadano || [];
    if (respuestasCiudadano.length === 0) {
        alert('Primero debes registrar la respuesta al ciudadano (Paso 8)');
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
        alert('Error al generar reporte: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

// ============ GENERAR PDF DEL REPORTE ============
// NOTA: A propósito este reporte NO incluye el historial de seguimiento
// interno (historialSeguimiento); solo incluye la información sustantiva del
// caso (datos generales, envío principal, envíos adicionales, respuestas de
// dependencia y respuestas al ciudadano).
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

            // Verifica si queda suficiente espacio en la página; si no,
            // agrega una página nueva ANTES de dibujar el contenido
            // (evita que el texto se corte al llegar al borde inferior).
            function checkPageBreak(alturaNecesaria) {
                if (y + alturaNecesaria > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            }

            function addLine(yPos, color = '#2563eb') {
                doc.setDrawColor(color);
                doc.setLineWidth(0.5);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                return yPos + 3;
            }

            function addSectionTitle(texto) {
                checkPageBreak(10);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text(texto, margin, y);
                y += 6;
            }

            // HEADER
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('REPORTE DE SEGUIMIENTO', pageWidth / 2, y, { align: 'center' });
            y += 10;

            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Folio: ' + t.folio, pageWidth / 2, y, { align: 'center' });
            y += 7;

            doc.setFontSize(10);
            doc.setTextColor(85, 85, 85);
            doc.text('Generado: ' + new Date().toLocaleString('es-MX'), pageWidth / 2, y, { align: 'center' });
            y += 7;

            y = addLine(y);
            y += 5;

            // 1. DATOS GENERALES
            addSectionTitle('1. DATOS GENERALES');

            // Calcular días hábiles para el reporte
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

            const datos = [
                ['Folio:', t.folio],
                ['Nombre:', t.nombre],
                ['Correo:', t.email || 'No proporcionado'],
                ['Teléfono:', t.telefono || 'No proporcionado'],
                ['Asunto:', t.asunto || 'Sin clasificar'],
                ['Dependencia:', t.dependencia || 'Sin asignar'],
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

            // 2. ENVÍO A DEPENDENCIA (PRINCIPAL) — siempre envios[0]
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

                doc.setTextColor(85, 85, 85);
                doc.setFontSize(9);
                doc.text('Elaboración: ' + fechaElab + ' | Recibido: ' + fechaRec, margin + 3, y);
                y += 4;
                doc.text('Registrado por: ' + envioPrincipal.usuario, margin + 3, y);
                y += 5;
            }

            // 2.1 ENVÍOS ADICIONALES A DEPENDENCIA — envios[1..n]
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

                    doc.setTextColor(85, 85, 85);
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

                    doc.setTextColor(85, 85, 85);
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
                    // Sin hora: la fecha de respuesta al ciudadano solo registra el día.
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

                    doc.setTextColor(85, 85, 85);
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
            doc.setTextColor(85, 85, 85);
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
    const paso6Div = document.getElementById('paso6');

    if (ticketData.asunto === 'no_procede' || ticketData.estado === 'cerrado' || ticketData.estado === 'resuelto') {
        contadorDiv.innerHTML = '<p style="color: #999;">Ticket cerrado o resuelto</p>';
        alertaDiv.style.display = 'none';
        paso6Div.style.display = 'none';
        return;
    }

    const fechaRecibido = obtenerFechaRecibidoPrimerEnvio();
    if (!fechaRecibido) {
        contadorDiv.innerHTML = `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px;">
                <p><strong>No se puede contar días hábiles</strong></p>
                <p>La fecha de recibido en dependencia no está registrada.</p>
                <p>Por favor, actualiza la fecha de recibido para comenzar el conteo.</p>
            </div>
        `;
        alertaDiv.style.display = 'none';
        paso6Div.style.display = 'none';
        return;
    }

    const diasHabiles = calcularDiasHabiles(fechaRecibido, fechaHoy());
    diasHabilesTranscurridos = diasHabiles;

    contadorDiv.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <p><strong>Fecha de recibido (primer envío):</strong> ${formatearFecha(fechaRecibido)}</p>
            <p><strong>Días hábiles transcurridos:</strong> <span style="font-size: 1.5em; font-weight: bold; ${diasHabiles >= 10 ? 'color: #dc2626;' : 'color: #16a34a;'}">${diasHabiles}</span></p>
            <p><strong>Límite:</strong> 10 días hábiles</p>
            ${diasHabiles < 10 ? '<p><strong>Días restantes:</strong> ' + (10 - diasHabiles) + '</p>' : ''}
        </div>
    `;

    if (diasHabiles >= 10) {
        alertaDiv.style.display = 'block';
        document.getElementById('mensajeVencimiento').textContent =
            'Este ticket tiene ' + diasHabiles + ' días hábiles sin respuesta. Se recomienda enviar un nuevo oficio.';

        paso6Div.style.display = 'block';

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
        paso6Div.style.display = 'none';
    }
}

// ============ HISTORIAL ============
async function agregarHistorial(accion, descripcion) {
    try {
        const historialEntry = {
            fecha: new Date().toISOString(),
            accion: accion,
            descripcion: descripcion,
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
        container.innerHTML = '<p style="color: #999;">Sin historial de seguimiento</p>';
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

console.log('seguimiento.js cargado correctamente');