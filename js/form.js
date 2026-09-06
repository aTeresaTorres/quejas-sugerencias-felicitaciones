// ============ FORMULARIO ============
document.getElementById('quejaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const asunto = document.getElementById('asunto').value;
    const mensaje = document.getElementById('mensaje').value.trim();
    
    // VALIDACIONES
    if (!nombre || !asunto || !mensaje) {
        alert('Por favor, completa todos los campos obligatorios');
        return;
    }
    
    // Validar que al menos un contacto esté presente
    if (!email && !telefono) {
        alert('Debes proporcionar al menos un medio de contacto (correo o teléfono)');
        return;
    }
    
    // Validar email si se proporcionó
    if (email && !validarEmail(email)) {
        alert('Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com)');
        return;
    }
    
    // Validar teléfono si se proporcionó
    if (telefono) {
        const telefonoLimpio = telefono.replace(/\s/g, '');
        if (!validarTelefono(telefonoLimpio)) {
            alert('Por favor, ingresa un número de teléfono válido de 10 dígitos (ejemplo: 5512345678)');
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
    
    // PREPARAR DATOS
    const ticketData = {
        folio: folio,
        nombre: nombre,
        contacto: email || telefono,
        tipoContacto: email ? 'email' : 'telefono',
        email: email || null,
        telefono: telefono || null,
        asunto: asunto,
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
        
        // MOSTRAR CONFIRMACIÓN
        mostrarConfirmacion(ticketData);
        
        // LIMPIAR FORMULARIO
        this.reset();
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Hubo un error al enviar tu asunto. Por favor, intenta de nuevo.\n\n' + error.message);
    }
});

// ============ FUNCIONES DE VALIDACIÓN ============
function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validarTelefono(telefono) {
    const re = /^\d{10}$/;
    return re.test(telefono.replace(/\s/g, ''));
}

// ============ MOSTRAR CONFIRMACIÓN ============
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
    
    const recibo = document.getElementById('recibo');
    recibo.innerHTML = `
        <div class="recibo-card" id="reciboContent">
            <h3>📋 RECIBO DE REGISTRO</h3>
            <p><strong>Folio:</strong> <span style="color: #007bff; font-size: 1.2em;">${data.folio}</span></p>
            <p><strong>Nombre:</strong> ${data.nombre}</p>
            <p><strong>Contacto:</strong> ${data.contacto}</p>
            <p><strong>Tipo de contacto:</strong> ${data.tipoContacto === 'email' ? 'Correo electrónico' : 'Teléfono'}</p>
            <p><strong>Asunto:</strong> ${data.asunto.charAt(0).toUpperCase() + data.asunto.slice(1)}</p>
            <p><strong>Mensaje:</strong></p>
            <div style="background: #f1f1f1; padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${data.mensaje}
            </div>
            <p><strong>Fecha y hora:</strong> ${fechaStr}</p>
            <hr>
            <p style="font-size: 0.9em; color: #666;">Guarda este recibo para cualquier seguimiento</p>
        </div>
    `;
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
    
    // Mostrar loading
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
// Mostrar ayuda para el teléfono
document.getElementById('telefono').addEventListener('input', function(e) {
    // Solo permitir números
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length > 10) {
        this.value = this.value.slice(0, 10);
    }
});

// Formatear teléfono mientras se escribe (opcional)
document.getElementById('telefono').addEventListener('blur', function() {
    if (this.value.length === 10) {
        // Formato: 55 1234 5678
        this.value = this.value.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
    }
});

// ============ VOLVER AL FORMULARIO ============
function volverAlFormulario() {
    // Mostrar el formulario nuevamente
    document.getElementById('quejaForm').style.display = 'block';
    document.getElementById('quejaForm').reset();
    
    // Ocultar la confirmación
    document.getElementById('confirmacion').style.display = 'none';
    
    // Hacer scroll al inicio del formulario
    document.querySelector('.container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}
