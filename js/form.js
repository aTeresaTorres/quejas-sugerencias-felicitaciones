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
        
        // Guardar los datos para el PDF
        window.datosRecibo = {
            folio: folio,
            nombre: nombre,
            email: email || 'No proporcionado',
            telefono: telefono || 'No proporcionado',
            mensaje: mensaje,
            fecha: new Date().toLocaleString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            })
        };
        
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

// ============ CARGAR CONFIGURACIÓN ============
async function cargarConfiguracionPublica() {
    try {
        const doc = await db.collection('configuracion').doc('general').get();
        if (doc.exists) {
            const data = doc.data();
            
            // Título del buzón
            if (data.nombreBuzon) {
                document.getElementById('tituloBuzon').textContent = data.nombreBuzon;
            }
            
            // Información de contacto - Múltiples correos y teléfonos
            const emails = data.emailsContacto || (data.emailContacto ? [data.emailContacto] : ['administracion@tuorganizacion.com']);
            const telefonos = data.telefonosContacto || (data.telefonoContacto ? [data.telefonoContacto] : ['(55) 1234-5678']);
            
            // Mostrar primer correo y teléfono en el lugar principal
            if (emails.length > 0) {
                document.getElementById('infoEmail').textContent = emails[0];
                // Si hay más de un correo, mostrarlos como lista
                if (emails.length > 1) {
                    document.getElementById('infoEmail').textContent = emails.join(' / ');
                }
            }
            
            if (telefonos.length > 0) {
                document.getElementById('infoTelefono').textContent = telefonos[0];
                if (telefonos.length > 1) {
                    document.getElementById('infoTelefono').textContent = telefonos.join(' / ');
                }
            }
            
            if (data.horarioAtencion) {
                document.getElementById('infoHorario').textContent = data.horarioAtencion;
            }
            if (data.direccionContacto) {
                document.getElementById('infoDireccion').style.display = 'block';
                document.getElementById('infoDireccionTexto').textContent = data.direccionContacto;
            }
            if (data.descripcionBuzon) {
                document.getElementById('infoTitulo').textContent = data.descripcionBuzon;
            }
        }
    } catch (error) {
        console.error('Error al cargar configuración pública:', error);
    }
}

// Llamar a la función al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que Firebase esté listo
    if (typeof db !== 'undefined') {
        cargarConfiguracionPublica();
    } else {
        setTimeout(cargarConfiguracionPublica, 1000);
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
            <h3><i class="fas fa-receipt"></i> RECIBO DE REGISTRO</h3>
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
    const btn = document.querySelector('[onclick="generarPDF()"]');
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Generando PDF...';
    btn.disabled = true;

    try {
        // Obtener los datos del recibo
        const data = obtenerDatosRecibo();
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // ========== HEADER ==========
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 58, 92);
        doc.text('RECIBO DE REGISTRO', pageWidth / 2, y, { align: 'center' });
        y += 10;

        // Línea decorativa
        doc.setDrawColor(26, 58, 92);
        doc.setLineWidth(0.8);
        doc.line(margin + 20, y, pageWidth - margin - 20, y);
        y += 10;

        // Folio destacado
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Folio:', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text(data.folio, margin + 25, y);
        y += 10;

        // ========== DATOS DEL SOLICITANTE ==========
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(26, 58, 92);
        doc.text('DATOS DEL SOLICITANTE', margin, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const datos = [
            ['Nombre:', data.nombre],
            ['Correo electrónico:', data.email],
            ['Teléfono:', data.telefono],
        ];

        datos.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(label, margin + 3, y);
            const labelWidth = doc.getTextWidth(label);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50, 50, 50);
            doc.text(String(value), margin + labelWidth + 8, y);
            y += 6;
        });

        y += 4;

        // ========== MENSAJE ==========
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(26, 58, 92);
        doc.text('MENSAJE', margin, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const mensajeLines = doc.splitTextToSize(data.mensaje || 'Sin mensaje', pageWidth - (margin * 2) - 6);
        
        // Fondo para el mensaje
        const alturaMensaje = mensajeLines.length * 5 + 8;
        if (y + alturaMensaje > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        
        doc.setFillColor(241, 241, 241);
        doc.roundedRect(margin + 2, y - 3, pageWidth - (margin * 2) - 4, alturaMensaje + 4, 3, 3, 'F');
        
        doc.setTextColor(50, 50, 50);
        doc.text(mensajeLines, margin + 6, y + 4);
        y += alturaMensaje + 8;

        // ========== FECHA ==========
        if (y + 20 > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Fecha de registro:', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(data.fecha, margin, y);
        y += 10;

        // ========== LÍNEA FINAL ==========
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin + 10, y, pageWidth - margin - 10, y);
        y += 8;

        // ========== FOOTER ==========
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Tu asunto será clasificado por nuestro equipo de administración', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Sistema de Buzón Ciudadano', pageWidth / 2, y, { align: 'center' });

        // ========== GUARDAR ==========
        doc.save('recibo-' + data.folio + '-' + new Date().getTime() + '.pdf');

        btn.textContent = textoOriginal;
        btn.disabled = false;

    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el PDF: ' + error.message + '\nPor favor, intenta de nuevo.');
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
}

// ============ OBTENER DATOS DEL RECIBO ============
function obtenerDatosRecibo() {
    // Primero intentar obtener los datos guardados en la variable global
    if (window.datosRecibo) {
        return window.datosRecibo;
    }
    
    // Si no, intentar extraer del DOM
    try {
        const reciboContent = document.getElementById('reciboContent');
        if (!reciboContent) {
            throw new Error('No se encontró el contenido del recibo');
        }
        
        // Función auxiliar para obtener texto de un elemento
        const getText = (selector) => {
            const element = reciboContent.querySelector(selector);
            return element ? element.textContent.trim() : '';
        };
        
        // Extraer folio
        const folioSpan = reciboContent.querySelector('span[style*="color: #007bff"]');
        const folio = folioSpan ? folioSpan.textContent.trim() : 'N/A';
        
        // Extraer nombre
        const nombreText = getText('p:not(:has(span)):first-of-type');
        const nombre = nombreText.replace('Nombre:', '').trim() || 'N/A';
        
        // Extraer email
        let email = 'No proporcionado';
        const emailElement = reciboContent.querySelector('p:contains("Correo electrónico:")');
        if (emailElement) {
            email = emailElement.textContent.replace('Correo electrónico:', '').trim();
        }
        
        // Extraer teléfono
        let telefono = 'No proporcionado';
        const telefonoElement = reciboContent.querySelector('p:contains("Teléfono:")');
        if (telefonoElement) {
            telefono = telefonoElement.textContent.replace('Teléfono:', '').trim();
        }
        
        // Extraer mensaje
        const mensajeDiv = reciboContent.querySelector('div[style*="background: #f1f1f1"]');
        const mensaje = mensajeDiv ? mensajeDiv.textContent.trim() : 'Sin mensaje';
        
        // Extraer fecha
        const fechaText = getText('p:contains("Fecha y hora:")');
        const fecha = fechaText.replace('Fecha y hora:', '').trim() || new Date().toLocaleString('es-MX');
        
        return {
            folio: folio,
            nombre: nombre,
            email: email,
            telefono: telefono,
            mensaje: mensaje,
            fecha: fecha
        };
        
    } catch (error) {
        console.warn('Error al extraer datos del DOM, usando valores por defecto:', error);
        return {
            folio: 'N/A',
            nombre: 'N/A',
            email: 'No proporcionado',
            telefono: 'No proporcionado',
            mensaje: 'Sin mensaje',
            fecha: new Date().toLocaleString('es-MX')
        };
    }
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