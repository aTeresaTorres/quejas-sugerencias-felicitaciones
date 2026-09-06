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
    
    // Validar que al menos un contacto esté presente
    if (!email && !telefono) {
        alert('Debes proporcionar al menos un medio de contacto (correo o teléfono)');
        return;
    }
    
    // ✅ VALIDACIÓN MEJORADA DE EMAIL
    if (email) {
        const emailValido = await validarEmailReal(email);
        if (!emailValido) {
            alert('❌ El correo electrónico no parece ser válido o no existe. Por favor, verifica la dirección.');
            return;
        }
    }
    
    // ✅ VALIDACIÓN MEJORADA DE TELÉFONO
    if (telefono) {
        const telefonoLimpio = telefono.replace(/\s/g, '');
        const telefonoValido = await validarTelefonoReal(telefonoLimpio);
        if (!telefonoValido) {
            alert('❌ El número de teléfono no parece ser válido. Por favor, verifica el número (10 dígitos).');
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
    
    // PREPARAR DATOS (SIN asunto, lo asignará el admin)
    const ticketData = {
        folio: folio,
        nombre: nombre,
        contacto: email || telefono,
        tipoContacto: email ? 'email' : 'telefono',
        email: email || null,
        telefono: telefono || null,
        // ❌ ELIMINADO: asunto (ya no lo selecciona el usuario)
        asunto: 'pendiente_clasificar', // Valor por defecto
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

// ============ VALIDACIÓN DE EMAIL REAL ============
async function validarEmailReal(email) {
    // 1. Validar formato básico
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
        console.log('❌ Formato de email inválido');
        return false;
    }
    
    // 2. Verificar que el dominio tenga registros MX (exista)
    try {
        const dominio = email.split('@')[1];
        const respuesta = await fetch(`https://api.mailcheck.ai/domain/${dominio}`);
        const data = await respuesta.json();
        
        // Si el dominio tiene registros MX, es válido
        if (data.mx) {
            console.log('✅ Dominio válido con MX records');
            return true;
        } else {
            console.log('❌ Dominio sin MX records');
            return false;
        }
    } catch (error) {
        console.warn('⚠️ No se pudo verificar el dominio, pero el formato es válido');
        // Si falla la verificación, al menos validamos el formato
        return true;
    }
}

// ============ VALIDACIÓN DE TELÉFONO REAL ============
async function validarTelefonoReal(telefono) {
    // 1. Validar formato (10 dígitos para México)
    const re = /^\d{10}$/;
    if (!re.test(telefono)) {
        console.log('❌ Formato de teléfono inválido (deben ser 10 dígitos)');
        return false;
    }
    
    // 2. Verificar que el número exista usando una API gratuita
    try {
        // Usamos una API gratuita para verificar números (limitada)
        const respuesta = await fetch(`https://api.veriphone.io/v2/verify?phone=%2B52${telefono}&key=5B923F14B26444A89EC40AA5D437E3A3`);
        const data = await respuesta.json();
        
        if (data && data.phone_valid) {
            console.log('✅ Teléfono válido:', data.country);
            return true;
        } else {
            console.log('❌ Teléfono inválido');
            return false;
        }
    } catch (error) {
        console.warn('⚠️ No se pudo verificar el teléfono, pero el formato es válido');
        // Si falla la API, al menos validamos el formato
        return true;
    }
}

// ============ VALIDACIÓN ALTERNATIVA (SIN API) ============
// Esta versión solo valida formato pero es más confiable (no depende de APIs externas)

function validarEmailFormato(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validarTelefonoFormato(telefono) {
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

// ============ VOLVER AL FORMULARIO ============
function volverAlFormulario() {
    document.getElementById('quejaForm').style.display = 'block';
    document.getElementById('quejaForm').reset();
    document.getElementById('confirmacion').style.display = 'none';
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
// Teléfono: solo números
document.getElementById('telefono').addEventListener('input', function(e) {
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length > 10) {
        this.value = this.value.slice(0, 10);
    }
});

// Formatear teléfono al perder el foco
document.getElementById('telefono').addEventListener('blur', function() {
    if (this.value.length === 10) {
        this.value = this.value.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
    }
});

// Validación visual de email en tiempo real
document.getElementById('email').addEventListener('blur', function() {
    const email = this.value.trim();
    if (email && !validarEmailFormato(email)) {
        this.style.borderColor = '#dc3545';
        this.style.backgroundColor = '#fff0f0';
    } else if (email) {
        this.style.borderColor = '#28a745';
        this.style.backgroundColor = '#f0fff0';
    } else {
        this.style.borderColor = '#e1e5eb';
        this.style.backgroundColor = 'white';
    }
});

// Validación visual de teléfono en tiempo real
document.getElementById('telefono').addEventListener('blur', function() {
    const telefono = this.value.replace(/\s/g, '');
    if (telefono && !validarTelefonoFormato(telefono)) {
        this.style.borderColor = '#dc3545';
        this.style.backgroundColor = '#fff0f0';
    } else if (telefono) {
        this.style.borderColor = '#28a745';
        this.style.backgroundColor = '#f0fff0';
    } else {
        this.style.borderColor = '#e1e5eb';
        this.style.backgroundColor = 'white';
    }
});