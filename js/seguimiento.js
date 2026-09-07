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
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-MX');
}

function formatearFechaHora(fecha) {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return d.toLocaleString('es-MX');
}

function obtenerFecha(fechaInput) {
    if (!fechaInput) return null;
    return new Date(fechaInput + 'T00:00:00');
}

function compararFechas(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return true;
    const d1 = new Date(fecha1 + 'T00:00:00');
    const d2 = new Date(fecha2 + 'T00:00:00');
    return d1 <= d2;
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
    
    switch(paso) {
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
            const ultimoEnvio = ticketData.enviosDependencia[ticketData.enviosDependencia.length - 1];
            if (!ultimoEnvio.fechaRecibido) {
                alert('Debes actualizar la fecha de recibido en la dependencia antes de continuar');
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
function mostrarEnvioDependencia() {
    const envios = ticketData.enviosDependencia || [];
    if (envios.length === 0) {
        document.getElementById('formEnvioDependencia').style.display = 'block';
        document.getElementById('envioDependenciaRegistrado').style.display = 'none';
        return;
    }
    
    const ultimoEnvio = envios[envios.length - 1];
    if (ultimoEnvio.tipo === 'envio_dependencia' || ultimoEnvio.tipo === 'envio_adicional') {
        document.getElementById('formEnvioDependencia').style.display = 'none';
        document.getElementById('envioDependenciaRegistrado').style.display = 'block';
        
        const fecha = new Date(ultimoEnvio.fecha);
        const fechaElab = ultimoEnvio.fechaElaboracion ? ultimoEnvio.fechaElaboracion : null;
        const fechaRec = ultimoEnvio.fechaRecibido ? ultimoEnvio.fechaRecibido : null;
        
        document.getElementById('envioDependenciaData').innerHTML = `
            <p><strong>Descripción:</strong> ${ultimoEnvio.descripcion}</p>
            <p><strong>Oficio:</strong> ${ultimoEnvio.oficio}</p>
            <p><strong>Fecha de elaboración:</strong> ${fechaElab ? formatearFecha(fechaElab) : 'N/A'}</p>
            <p><strong>Fecha de recibido:</strong> ${fechaRec ? formatearFecha(fechaRec) : 'No registrada'}</p>
            <p><strong>Fecha de registro:</strong> ${formatearFechaHora(fecha)}</p>
            <p><strong>Registrado por:</strong> ${ultimoEnvio.usuario}</p>
        `;
        
        const btnActualizar = document.querySelector('#envioDependenciaRegistrado .btn-secondary');
        if (btnActualizar) {
            if (ultimoEnvio.fechaRecibido) {
                btnActualizar.style.display = 'none';
            } else {
                btnActualizar.style.display = 'inline-block';
            }
        }
        
        if (ultimoEnvio.fechaRecibido) {
            mostrarPaso('paso7');
            mostrarPaso('contadorDias');
        }
    }
}

// ============ PASO 5: ACTUALIZAR FECHA DE RECIBIDO ============
function editarFechaRecibido() {
    const modal = document.createElement('div');
    modal.id = 'modalFechaRecibido';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; justify-content: center;
        align-items: center; z-index: 9999;
    `;
    
    // Obtener la fecha de elaboración del último envío para validación
    const envios = ticketData.enviosDependencia || [];
    const ultimoEnvio = envios[envios.length - 1];
    const fechaElaboracion = ultimoEnvio.fechaElaboracion || '';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h3 style="margin-bottom: 20px;">Actualizar fecha de recibido</h3>
            <div class="form-group">
                <label>Nueva fecha de recibido *</label>
                <input type="date" id="nuevaFechaRecibido" min="${fechaElaboracion}" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;">
                <small style="color: #666; display: block; margin-top: 4px;">La fecha debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)})</small>
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
        
        // Validar que no sea anterior a la fecha de elaboración
        if (fechaElaboracion && !compararFechas(fechaElaboracion, nuevaFecha)) {
            alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
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
            alert('No hay envíos registrados');
            return;
        }
        
        const ultimoIndex = envios.length - 1;
        envios[ultimoIndex].fechaRecibido = nuevaFecha;
        
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
    
    if (!descripcion || !oficio || !fechaElaboracion) {
        alert('Por favor, completa todos los campos obligatorios');
        ocultarLoading(btn, textoOriginal);
        return;
    }
    
    // Validar que la fecha de elaboración no sea anterior a la creación del ticket
    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = new Date(fechaCreacion).toISOString().split('T')[0];
        if (!compararFechas(fechaCreacionStr, fechaElaboracion)) {
            alert('La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }
    
    // Si hay fecha de recibido, validar que no sea anterior a la de elaboración
    if (fechaRecibido && !compararFechas(fechaElaboracion, fechaRecibido)) {
        alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
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
            tipo: 'envio_dependencia'
        };
        
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();
        const data = doc.data();
        
        const enviosActuales = data.enviosDependencia || [];
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
    
    const div = document.createElement('div');
    div.className = 'envio-adicional';
    div.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #17a2b8;">
            <h4>Envío adicional #${container.children.length + 1}</h4>
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
                    <input class="fecha-elaboracion-adicional" type="date">
                </div>
                <div class="form-group">
                    <label>Fecha recibido</label>
                    <input class="fecha-recibido-adicional" type="date">
                    <small>Opcional</small>
                </div>
            </div>
            <button onclick="registrarEnvioAdicional(this)" class="btn-success" style="margin-top: 10px;">Registrar envío</button>
            <button onclick="this.parentElement.remove()" style="background: #dc3545; margin-top: 10px; margin-left: 10px; color: white;">Eliminar</button>
        </div>
    `;
    
    container.appendChild(div);
}

async function registrarEnvioAdicional(btn) {
    const textoOriginal = mostrarLoading(btn);
    const parent = btn.parentElement;
    const descripcion = parent.querySelector('.desc-adicional').value.trim();
    const oficio = parent.querySelector('.oficio-adicional').value.trim();
    const fechaElaboracion = parent.querySelector('.fecha-elaboracion-adicional').value;
    const fechaRecibido = parent.querySelector('.fecha-recibido-adicional').value || null;
    
    if (!descripcion || !oficio || !fechaElaboracion) {
        alert('Por favor, completa todos los campos obligatorios');
        ocultarLoading(btn, textoOriginal);
        return;
    }
    
    // Validar fecha
    const fechaCreacion = ticketData.fechaCreacion;
    if (fechaCreacion) {
        const fechaCreacionStr = new Date(fechaCreacion).toISOString().split('T')[0];
        if (!compararFechas(fechaCreacionStr, fechaElaboracion)) {
            alert('La fecha de elaboración no puede ser anterior a la fecha de creación del ticket');
            ocultarLoading(btn, textoOriginal);
            return;
        }
    }
    
    if (fechaRecibido && !compararFechas(fechaElaboracion, fechaRecibido)) {
        alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
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
        alert('Error al registrar: ' + error.message);
        ocultarLoading(btn, textoOriginal);
    }
}

function cargarEnviosAdicionales() {
    const container = document.getElementById('enviosAdicionalesContainer');
    const envios = ticketData.enviosDependencia || [];
    const adicionales = envios.filter(e => e.tipo === 'envio_adicional');
    
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
    const envios = ticketData.enviosDependencia || [];
    const adicionales = envios.filter(e => e.tipo === 'envio_adicional');
    const envio = adicionales[index];
    
    if (!envio) {
        alert('Envío no encontrado');
        return;
    }
    
    const fechaElaboracion = envio.fechaElaboracion || '';
    
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
                <input type="date" id="nuevaFechaRecibidoAdicional" min="${fechaElaboracion}" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;">
                <small style="color: #666; display: block; margin-top: 4px;">La fecha debe ser igual o posterior a la fecha de elaboración (${formatearFecha(fechaElaboracion)})</small>
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
        
        if (fechaElaboracion && !compararFechas(fechaElaboracion, nuevaFecha)) {
            alert('La fecha de recibido no puede ser anterior a la fecha de elaboración');
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
        
        const adicionales = envios.filter(e => e.tipo === 'envio_adicional');
        if (index >= adicionales.length) {
            alert('Envío no encontrado');
            return;
        }
        
        let realIndex = -1;
        let count = 0;
        for (let i = 0; i < envios.length; i++) {
            if (envios[i].tipo === 'envio_adicional') {
                if (count === index) {
                    realIndex = i;
                    break;
                }
                count++;
            }
        }
        
        if (realIndex === -1) {
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
        <p><strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFecha(fechaResp) : 'N/A'}</p>
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
    
    if (!descripcion || !oficio || !fecha) {
        alert('Por favor, completa todos los campos');
        ocultarLoading(btn, textoOriginal);
        return;
    }
    
    // Validar que la fecha de respuesta no sea anterior a la fecha de recibido
    const envios = ticketData.enviosDependencia || [];
    const ultimoEnvio = envios[envios.length - 1];
    if (ultimoEnvio && ultimoEnvio.fechaRecibido && !compararFechas(ultimoEnvio.fechaRecibido, fecha)) {
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
        return;
    }
    
    const ultimaRespuesta = respuestas[respuestas.length - 1];
    
    document.getElementById('formRespuestaCiudadano').style.display = 'none';
    document.getElementById('respuestaCiudadanoRegistrada').style.display = 'block';
    
    const fecha = new Date(ultimaRespuesta.fecha);
    const fechaResp = ultimaRespuesta.fechaRespuesta ? ultimaRespuesta.fechaRespuesta : null;
    
    document.getElementById('respuestaCiudadanoData').innerHTML = `
        <p><strong>Descripción:</strong> ${ultimaRespuesta.descripcion}</p>
        <p><strong>Fecha de respuesta:</strong> ${fechaResp ? formatearFecha(fechaResp) : 'N/A'}</p>
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
    
    if (!descripcion || !fecha) {
        alert('Por favor, completa todos los campos');
        ocultarLoading(btn, textoOriginal);
        return;
    }
    
    // Validar que la fecha de respuesta no sea anterior a la fecha de respuesta de dependencia
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
            await agregarHistorial('Ticket resuelto', 'Se generó el reporte final');
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
            
            function addWrappedText(text, x, y, maxWidth, fontSize = 10, style = 'normal') {
                doc.setFontSize(fontSize);
                doc.setFont('helvetica', style);
                const lines = doc.splitTextToSize(text, maxWidth);
                doc.text(lines, x, y);
                return y + (lines.length * (fontSize * 0.4));
            }
            
            function addLine(y, color = '#2563eb') {
                doc.setDrawColor(color);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                return y + 3;
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
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text('1. DATOS GENERALES', margin, y);
            y += 6;
            
            const datos = [
                ['Folio:', t.folio],
                ['Nombre:', t.nombre],
                ['Correo:', t.email || 'No proporcionado'],
                ['Teléfono:', t.telefono || 'No proporcionado'],
                ['Asunto:', t.asunto || 'Sin clasificar'],
                ['Dependencia:', t.dependencia || 'Sin asignar'],
                ['Estado:', 'RESUELTO'],
                ['Fecha creación:', formatearFechaHora(t.fechaCreacion)],
                ['Fecha resolución:', formatearFechaHora(t.fechaResolucion) || new Date().toLocaleString('es-MX')]
            ];
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            datos.forEach(([label, value]) => {
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'bold');
                doc.text(label, margin, y);
                const labelWidth = doc.getTextWidth(label);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50, 50, 50);
                doc.text(value, margin + labelWidth + 3, y);
                y += 5;
            });
            y += 3;
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('Mensaje del usuario:', margin, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50, 50, 50);
            const mensajeLines = doc.splitTextToSize(t.mensaje || 'Sin mensaje', pageWidth - (margin * 2));
            doc.text(mensajeLines, margin, y);
            y += mensajeLines.length * 4 + 5;
            
            y = addLine(y);
            y += 5;
            
            // 2. ENVÍOS A DEPENDENCIA
            const envios = t.enviosDependencia || [];
            if (envios.length > 0) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text('2. ENVÍOS A DEPENDENCIA', margin, y);
                y += 6;
                
                envios.forEach((envio, index) => {
                    const tipo = envio.tipo === 'envio_adicional' ? 'Adicional' : 'Inicial';
                    const fechaElab = envio.fechaElaboracion ? formatearFecha(envio.fechaElaboracion) : 'N/A';
                    const fechaRec = envio.fechaRecibido ? formatearFecha(envio.fechaRecibido) : 'No registrado';
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Envío ' + tipo + ' #' + (index + 1) + ' - ' + formatearFechaHora(envio.fecha), margin, y);
                    y += 4;
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text('Oficio: ' + envio.oficio, margin + 3, y);
                    y += 4;
                    
                    const descLines = doc.splitTextToSize('Descripción: ' + envio.descripcion, pageWidth - (margin * 2) - 3);
                    doc.text(descLines, margin + 3, y);
                    y += descLines.length * 4;
                    
                    doc.setTextColor(85, 85, 85);
                    doc.setFontSize(9);
                    doc.text('Elaboración: ' + fechaElab + ' | Recibido: ' + fechaRec, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + envio.usuario, margin + 3, y);
                    y += 5;
                    
                    if (y > pageHeight - 20) {
                        doc.addPage();
                        y = margin;
                    }
                });
                y += 2;
            }
            
            y = addLine(y);
            y += 5;
            
            // 3. RESPUESTAS DE DEPENDENCIA
            const respuestasDep = t.respuestasDependencia || [];
            if (respuestasDep.length > 0) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text('3. RESPUESTAS DE DEPENDENCIA', margin, y);
                y += 6;
                
                respuestasDep.forEach((resp, index) => {
                    const fechaResp = resp.fechaRespuesta ? formatearFecha(resp.fechaRespuesta) : 'N/A';
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Respuesta #' + (index + 1) + ' - ' + formatearFechaHora(resp.fecha), margin, y);
                    y += 4;
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text('Oficio: ' + resp.oficio, margin + 3, y);
                    y += 4;
                    
                    const descLines = doc.splitTextToSize('Descripción: ' + resp.descripcion, pageWidth - (margin * 2) - 3);
                    doc.text(descLines, margin + 3, y);
                    y += descLines.length * 4;
                    
                    doc.setTextColor(85, 85, 85);
                    doc.setFontSize(9);
                    doc.text('Fecha de respuesta: ' + fechaResp, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + resp.usuario, margin + 3, y);
                    y += 5;
                    
                    if (y > pageHeight - 20) {
                        doc.addPage();
                        y = margin;
                    }
                });
                y += 2;
            }
            
            y = addLine(y);
            y += 5;
            
            // 4. RESPUESTAS AL CIUDADANO
            const respuestasCiudadano = t.respuestasCiudadano || [];
            if (respuestasCiudadano.length > 0) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text('4. RESPUESTAS AL CIUDADANO', margin, y);
                y += 6;
                
                respuestasCiudadano.forEach((resp, index) => {
                    const fechaResp = resp.fechaRespuesta ? formatearFecha(resp.fechaRespuesta) : 'N/A';
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Respuesta #' + (index + 1) + ' - ' + formatearFechaHora(resp.fecha), margin, y);
                    y += 4;
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    const descLines = doc.splitTextToSize('Descripción: ' + resp.descripcion, pageWidth - (margin * 2) - 3);
                    doc.text(descLines, margin + 3, y);
                    y += descLines.length * 4;
                    
                    doc.setTextColor(85, 85, 85);
                    doc.setFontSize(9);
                    doc.text('Fecha de respuesta: ' + fechaResp, margin + 3, y);
                    y += 4;
                    doc.text('Registrado por: ' + resp.usuario, margin + 3, y);
                    y += 5;
                    
                    if (y > pageHeight - 20) {
                        doc.addPage();
                        y = margin;
                    }
                });
                y += 2;
            }
            
            y = addLine(y);
            y += 5;
            
            // 5. HISTORIAL
            const historial = t.historialSeguimiento || [];
            if (historial.length > 0) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text('5. HISTORIAL', margin, y);
                y += 6;
                
                historial.forEach(h => {
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(h.accion + ' - ' + formatearFechaHora(h.fecha), margin, y);
                    y += 4;
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(50, 50, 50);
                    doc.text(h.descripcion, margin + 3, y);
                    y += 4;
                    
                    doc.setTextColor(85, 85, 85);
                    doc.setFontSize(8);
                    doc.text('Por: ' + h.usuario, margin + 3, y);
                    y += 5;
                    
                    if (y > pageHeight - 15) {
                        doc.addPage();
                        y = margin;
                    }
                });
            }
            
            // FOOTER
            if (y > pageHeight - 20) {
                doc.addPage();
                y = margin;
            }
            
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
    
    const envios = ticketData.enviosDependencia || [];
    if (envios.length === 0) {
        contadorDiv.innerHTML = '<p style="color: #999;">No hay envío registrado</p>';
        alertaDiv.style.display = 'none';
        paso6Div.style.display = 'none';
        return;
    }
    
    let ultimoConFecha = null;
    for (let i = envios.length - 1; i >= 0; i--) {
        if (envios[i].fechaRecibido) {
            ultimoConFecha = envios[i];
            break;
        }
    }
    
    if (!ultimoConFecha) {
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
    
    const fechaBase = new Date(ultimoConFecha.fechaRecibido + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const diasHabiles = calcularDiasHabiles(fechaBase, hoy);
    diasHabilesTranscurridos = diasHabiles;
    
    contadorDiv.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <p><strong>Fecha de recibido:</strong> ${formatearFecha(ultimoConFecha.fechaRecibido)}</p>
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

// ============ CALCULAR DÍAS HÁBILES ============
function calcularDiasHabiles(fechaInicio, fechaFin) {
    let count = 0;
    const current = new Date(fechaInicio);
    current.setHours(0, 0, 0, 0);
    const end = new Date(fechaFin);
    end.setHours(0, 0, 0, 0);
    
    if (current > end) {
        return 0;
    }
    
    const diasFestivos = [
        '2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01',
        '2026-09-16', '2026-11-16', '2026-12-25'
    ];
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !diasFestivos.includes(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return count;
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
                <p><strong>${h.accion}</strong> - ${formatearFechaHora(fecha)}</p>
                <p>${h.descripcion}</p>
                <p><small>Por: ${h.usuario}</small></p>
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