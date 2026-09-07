// ============ FORMULARIO ============
document.getElementById('quejaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();
    
    // VALIDACIONES
    if (!nombre || !mensaje) {
        alert('Por favor, completa todos los campos obligatorios');
        return;
    }
    
    // ✅ Validar que al menos un contacto esté presente
    if (!email && !telefono) {
        alert('Debes proporcionar al menos un medio de contacto (correo o teléfono)');
        return;
    }
    
    // ✅ Validar email si se proporcionó
    let emailValido = false;
    if (email) {
        emailValido = validarEmailFormato(email);
        if (!emailValido) {
            alert('❌ El correo electrónico no tiene un formato válido. Ejemplo: usuario@dominio.com');
            return;
        }
    }
    
    // ✅ Validar teléfono si se proporcionó
    let telefonoValido = false;
    if (telefono) {
        const telefonoLimpio = telefono.replace(/\s/g, '');
        telefonoValido = validarTelefonoFormato(telefonoLimpio);
        if (!telefonoValido) {
            alert('❌ El número de teléfono debe ser válido y tener 10 dígitos. Ejemplo: 5512345678');
            return;
        }
    }
    
    // GENERAR FOLIO
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const folio = `BQ-${year}${month}${day}-${random}`;
    
    // ✅ PREPARAR DATOS - Guardar AMBOS contactos si existen
    const ticketData = {
        folio: folio,
        nombre: nombre,
        // ✅ Contacto principal (el que se usará para mostrar)
        contacto: email || telefono,
        // ✅ Tipo de contacto principal
        tipoContacto: email ? 'email' : 'telefono',
        // ✅ Guardar AMBOS contactos
        email: email || null,
        telefono: telefono || null,
        // ✅ Indicar si tiene ambos
        tieneAmbos: !!(email && telefono),
        asunto: 'pendiente_clasificar',
        mensaje: mensaje,
        estado: 'pendiente',
        dependencia: 'sin_asignar',
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
        respuestas: []
    };
    
    try {
        // GUARDAR EN FIRESTORE
        const docRef = await db.collection('tickets').add(ticketData);
        console.log('Ticket guardado con ID:', docRef.id);
        console.log('📧 Email:', email || 'No proporcionado');
        console.log('📞 Teléfono:', telefono || 'No proporcionado');
        console.log('📌 Ambos contactos:', ticketData.tieneAmbos ? 'Sí' : 'No');
        
        // MOSTRAR CONFIRMACIÓN
        mostrarConfirmacion(ticketData);
        
        // LIMPIAR FORMULARIO
        this.reset();
        
        // Resetear estilos de validación
        document.getElementById('email').style.borderColor = '#e1e5eb';
        document.getElementById('email').style.backgroundColor = 'white';
        document.getElementById('telefono').style.borderColor = '#e1e5eb';
        document.getElementById('telefono').style.backgroundColor = 'white';
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Hubo un error al enviar tu asunto. Por favor, intenta de nuevo.\n\n' + error.message);
    }
});

// ============ MOSTRAR CONFIRMACIÓN (ACTUALIZADA) ============
function mostrarConfirmacion(data) {
    document.getElementById('quejaForm').style.display = 'none';
    document.getElementById('confirmacion').style.display = 'block';
    
    const fecha = new Date();
    const fechaStr = fecha.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    
    // ✅ Mostrar los contactos correctamente
    let contactosHTML = '';
    if (data.email && data.telefono) {
        contactosHTML = `
            <p><strong>Correo electrónico:</strong> ${data.email}</p>
            <p><strong>Teléfono:</strong> ${data.telefono}</p>
        `;
    } else if (data.email) {
        contactosHTML = `
            <p><strong>Correo electrónico:</strong> ${data.email}</p>
            <p style="color: #666;"><em>Teléfono no proporcionado</em></p>
        `;
    } else if (data.telefono) {
        contactosHTML = `
            <p><strong>Teléfono:</strong> ${data.telefono}</p>
            <p style="color: #666;"><em>Correo no proporcionado</em></p>
        `;
    }
    
    const recibo = document.getElementById('recibo');
    recibo.innerHTML = `
        <div class="recibo-card" id="reciboContent">
            <h3>📋 RECIBO DE REGISTRO</h3>
            <p><strong>Folio:</strong> <span style="color: #007bff; font-size: 1.2em;">${data.folio}</span></p>
            <p><strong>Nombre:</strong> ${data.nombre}</p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
                <strong>Información de contacto:</strong>
                ${contactosHTML}
            </div>
            <p><strong>Mensaje:</strong></p>
            <div style="background: #f1f1f1; padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${data.mensaje}
            </div>
            <p><strong>Fecha y hora:</strong> ${fechaStr}</p>
            <hr>
            <p style="font-size: 0.9em; color: #666;">Tu asunto será clasificado por nuestro equipo de administración</p>
        </div>
    `;
}

// ============ VALIDACIÓN DE EMAIL ============
function validarEmailFormato(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(email)) return false;
    
    const partes = email.split('@');
    if (partes.length !== 2) return false;
    
    const [usuario, dominio] = partes;
    if (usuario.length < 2) return false;
    
    const partesDominio = dominio.split('.');
    if (partesDominio.length < 2) return false;
    if (partesDominio[partesDominio.length - 1].length < 2) return false;
    
    return true;
}

// ============ VALIDACIÓN DE TELÉFONO (SIN API) ============
function validarTelefonoFormato(telefono) {
    const limpio = telefono.replace(/\s/g, '').replace(/-/g, '');
    
    // Debe ser exactamente 10 dígitos
    if (!/^\d{10}$/.test(limpio)) return false;
    
    // No puede ser un número repetido
    if (/^(\d)\1{9}$/.test(limpio)) return false;
    
    // No puede ser secuencial simple
    if (/^0123456789$/.test(limpio) || /^9876543210$/.test(limpio)) return false;
    
    // Validar LADA (código de área) - México
    const lada = parseInt(limpio.substring(0, 2));
    if (lada < 20) return false;
    
    // No puede ser números de emergencia
    const numerosInvalidos = ['911', '066', '089', '065'];
    if (numerosInvalidos.includes(limpio.substring(0, 3))) return false;
    
    return true;
}

// ============ VOLVER AL FORMULARIO ============
function volverAlFormulario() {
    document.getElementById('quejaForm').style.display = 'block';
    document.getElementById('quejaForm').reset();
    document.getElementById('confirmacion').style.display = 'none';
    
    // Resetear estilos de validación
    document.getElementById('email').style.borderColor = '#e1e5eb';
    document.getElementById('email').style.backgroundColor = 'white';
    document.getElementById('telefono').style.borderColor = '#e1e5eb';
    document.getElementById('telefono').style.backgroundColor = 'white';
    
    document.querySelector('.container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// ============ GENERAR PDF ============
function generarPDF() {
    const element = document.getElementById('reciboContent');
    
    const opt = {
        margin:       1,
        filename:     `recibo-${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: 'avoid-all' }
    };
    
    const btn = document.querySelector('[onclick="generarPDF()"]');
    btn.textContent = '⏳ Generando PDF...';
    btn.disabled = true;
    
    html2pdf().set(opt).from(element).save().then(() => {
        btn.textContent = '📄 Guardar recibo en PDF';
        btn.disabled = false;
    }).catch(err => {
        console.error('Error al generar PDF:', err);
        alert('Error al generar el PDF. Por favor, intenta de nuevo.');
        btn.textContent = '📄 Guardar recibo en PDF';
        btn.disabled = false;
    });
}

// ============ VALIDACIÓN EN TIEMPO REAL ============

// Teléfono: solo números y limitar a 10 dígitos
document.getElementById('telefono').addEventListener('input', function(e) {
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length > 10) {
        this.value = this.value.slice(0, 10);
    }
});