// ============ FORMULARIO ============
document.getElementById('quejaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Enviando...';
    btn.disabled = true;
    
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();
    
    if (!nombre || !mensaje) {
        alert('Por favor, completa todos los campos obligatorios');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    if (!email && !telefono) {
        alert('Debes proporcionar al menos un medio de contacto (correo o teléfono)');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
    }
    
    let emailValido = false;
    if (email) {
        emailValido = validarEmailFormato(email);
        if (!emailValido) {
            alert('❌ El correo electrónico no tiene un formato válido. Ejemplo: usuario@dominio.com');
            btn.textContent = textoOriginal;
            btn.disabled = false;
            return;
        }
    }
    
    let telefonoValido = false;
    if (telefono) {
        const telefonoLimpio = telefono.replace(/\s/g, '');
        telefonoValido = validarTelefonoFormato(telefonoLimpio);
        if (!telefonoValido) {
            alert('❌ El número de teléfono debe ser válido y tener 10 dígitos. Ejemplo: 5512345678');
            btn.textContent = textoOriginal;
            btn.disabled = false;
            return;
        }
    }
    
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const folio = `BQ-${year}${month}${day}-${random}`;
    
    const ticketData = {
        folio: folio,
        nombre: nombre,
        contacto: email || telefono,
        tipoContacto: email ? 'email' : 'telefono',
        email: email || null,
        telefono: telefono || null,
        tieneAmbos: !!(email && telefono),
        asunto: 'pendiente_clasificar',
        mensaje: mensaje,
        estado: 'pendiente',
        dependencia: 'sin_asignar',
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        respuestas: [],
        historialSeguimiento: [],
        enviosDependencia: [],
        respuestasDependencia: [],
        respuestasCiudadano: []
    };
    
    try {
        const docRef = await db.collection('tickets').add(ticketData);
        console.log('Ticket guardado con ID:', docRef.id);
        
        mostrarConfirmacion(ticketData);
        
        this.reset();
        
        document.getElementById('email').style.borderColor = '#e1e5eb';
        document.getElementById('email').style.backgroundColor = 'white';
        document.getElementById('telefono').style.borderColor = '#e1e5eb';
        document.getElementById('telefono').style.backgroundColor = 'white';
        
        btn.textContent = textoOriginal;
        btn.disabled = false;
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Hubo un error al enviar tu asunto. Por favor, intenta de nuevo.\n\n' + error.message);
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

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

// ============ GENERAR PDF (CORREGIDO) ============
function generarPDF() {
    const element = document.getElementById('reciboContent');
    const btn = document.querySelector('[onclick="generarPDF()"]');
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Generando PDF...';
    btn.disabled = true;

    // ANCHO_RECIBO fijo para que el render sea predecible
    const ANCHO_RECIBO = 600;

    // Clonar el elemento para no afectar el DOM visible
    const clone = element.cloneNode(true);
    clone.style.width = ANCHO_RECIBO + 'px';
    clone.style.maxWidth = ANCHO_RECIBO + 'px';
    clone.style.boxSizing = 'border-box';
    clone.style.padding = '20px';
    clone.style.fontSize = '14px';
    clone.style.fontFamily = 'Arial, sans-serif';
    clone.style.color = '#333';
    clone.style.backgroundColor = '#ffffff';
    clone.style.margin = '0';
    clone.style.borderRadius = '8px';
    clone.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

    // Asegurar que todos los elementos tengan estilos inline consistentes
    clone.querySelectorAll('*').forEach(el => {
        el.style.fontFamily = 'Arial, sans-serif';
    });

    // Contenedor temporal, sacado de pantalla
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '-10000px';
    wrapper.style.width = ANCHO_RECIBO + 'px';
    wrapper.style.padding = '20px';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.boxSizing = 'content-box';
    wrapper.appendChild(clone);

    document.body.appendChild(wrapper);

    const opt = {
        margin: 10,
        filename: `recibo-${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: ANCHO_RECIBO + 40
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(wrapper).save()
        .then(() => {
            if (wrapper.parentNode) document.body.removeChild(wrapper);
            btn.textContent = textoOriginal;
            btn.disabled = false;
        })
        .catch(err => {
            console.error('Error al generar PDF:', err);
            alert('Error al generar el PDF. Por favor, intenta de nuevo.');
            if (wrapper.parentNode) document.body.removeChild(wrapper);
            btn.textContent = textoOriginal;
            btn.disabled = false;
        });
}

// ============ VALIDACIONES ============
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

function validarTelefonoFormato(telefono) {
    const limpio = telefono.replace(/\s/g, '').replace(/-/g, '');
    
    if (!/^\d{10}$/.test(limpio)) return false;
    if (/^(\d)\1{9}$/.test(limpio)) return false;
    if (/^0123456789$/.test(limpio) || /^9876543210$/.test(limpio)) return false;
    
    const lada = parseInt(limpio.substring(0, 2));
    if (lada < 20) return false;
    
    const numerosInvalidos = ['911', '066', '089', '065'];
    if (numerosInvalidos.includes(limpio.substring(0, 3))) return false;
    
    return true;
}

// ============ VOLVER AL FORMULARIO ============
function volverAlFormulario() {
    document.getElementById('quejaForm').style.display = 'block';
    document.getElementById('quejaForm').reset();
    document.getElementById('confirmacion').style.display = 'none';
    
    document.getElementById('email').style.borderColor = '#e1e5eb';
    document.getElementById('email').style.backgroundColor = 'white';
    document.getElementById('telefono').style.borderColor = '#e1e5eb';
    document.getElementById('telefono').style.backgroundColor = 'white';
    
    document.querySelector('.container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// ============ VALIDACIÓN EN TIEMPO REAL ============
document.getElementById('telefono').addEventListener('input', function(e) {
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length > 10) {
        this.value = this.value.slice(0, 10);
    }
});

document.getElementById('telefono').addEventListener('blur', function() {
    const telefono = this.value.replace(/\s/g, '');
    if (telefono.length === 10) {
        this.value = telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
        if (validarTelefonoFormato(telefono)) {
            this.style.borderColor = '#28a745';
            this.style.backgroundColor = '#f0fff0';
        } else {
            this.style.borderColor = '#dc3545';
            this.style.backgroundColor = '#fff0f0';
        }
    } else if (telefono.length > 0 && telefono.length < 10) {
        this.style.borderColor = '#dc3545';
        this.style.backgroundColor = '#fff0f0';
    } else {
        this.style.borderColor = '#e1e5eb';
        this.style.backgroundColor = 'white';
    }
});

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

document.getElementById('email').addEventListener('input', function() {
    const email = this.value.trim();
    if (email.length > 5) {
        if (validarEmailFormato(email)) {
            this.style.borderColor = '#28a745';
            this.style.backgroundColor = '#f0fff0';
        } else {
            this.style.borderColor = '#ffc107';
            this.style.backgroundColor = '#fff8e1';
        }
    } else {
        this.style.borderColor = '#e1e5eb';
        this.style.backgroundColor = 'white';
    }
});

console.log('✅ form.js cargado correctamente');