const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
const cron = require('node-cron');
const fs = require('fs');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.CHROME_PATH || undefined, // Railway asignará esto automáticamente
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- BASE DE DATOS (ARCHIVO JSON) ---
const PATH_CITAS = './citas.json';

function cargarCitas() {
    if (fs.existsSync(PATH_CITAS)) {
        try {
            const data = fs.readFileSync(PATH_CITAS, 'utf-8');
            const citasCargadas = JSON.parse(data);
            return citasCargadas.map(c => ({
                ...c,
                fecha: moment(c.fecha) // Convertir texto a objeto de fecha
            }));
        } catch (e) {
            return [];
        }
    }
    return [];
}

function guardarCitas(listaCitas) {
    // Antes de guardar, convertimos las fechas de moment a texto para que el JSON lo entienda
    const dataParaGuardar = listaCitas.map(c => ({
        ...c,
        fecha: c.fecha.toISOString()
    }));
    fs.writeFileSync(PATH_CITAS, JSON.stringify(dataParaGuardar, null, 2));
}

let appointments = cargarCitas();
let userState = {};

// --- INICIO DEL BOT ---
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el QR para iniciar sesión');
});

client.on('ready', () => {
    console.log('¡Bot de Barbería en línea y cargando citas anteriores!');
});

client.on('message', async msg => {
    const from = msg.from;
    const text = msg.body;

    // Saludo inicial o reset
    if (!userState[from] || text.toLowerCase() === 'hola' || text.toLowerCase() === 'menu') {
        userState[from] = { step: 'menu' };
        await client.sendMessage(from, "¡Hola! Bienvenido a la Barbería. 💈\nEs un gusto saludarte. ¿En qué puedo ayudarte?\n\n1. ¿Deseas agendar cita?\n2. Citas disponibles\n3. Precios");
        return;
    }

    const state = userState[from];

    switch (state.step) {
        case 'menu':
            if (text === '1') {
                state.step = 'ask_name';
                await client.sendMessage(from, "Excelente. Por favor, dime tu **Nombre y Apellido**:");
            } else if (text === '2') {
                await client.sendMessage(from, "📅 *Horarios:* 9:00 a 19:00 (cada 45 min).\nEscribe '1' para agendar y verificar disponibilidad.");
            } else if (text === '3') {
                await client.sendMessage(from, "✨ *Precios:*\n- Corte: Q20.00 (Variable)\n- Barba: Q15.00\n- Corte y Barba: Q30.00 (Variable)");
                userState[from] = null;
            } else {
                await client.sendMessage(from, "Por favor, elige una opción válida (1, 2 o 3).");
            }
            break;

        case 'ask_name':
            state.userName = text;
            state.step = 'ask_datetime';
            await client.sendMessage(from, `Gracias ${text}. ¿Para qué fecha y hora?\nEscríbelo así: *Día, Mes Hora:Min*\nEjemplo: *15, 03 14:30*`);
            break;

        case 'ask_datetime':
            const fechaCita = moment(text, "DD, MM HH:mm", true);
            
            if (fechaCita.isValid()) {
                // Verificar si está en horario laboral
                const hora = fechaCita.hour();
                if (hora < 9 || hora >= 19) {
                    await client.sendMessage(from, "❌ Lo sentimos, el horario de atención es de 9:00 a 19:00. Intenta con otra hora.");
                    return;
                }

                const nuevaCita = {
                    cliente: state.userName,
                    numero: from,
                    fecha: fechaCita,
                    notificado1h: false,
                    notificado30m: false
                };
                
                appointments.push(nuevaCita);
                guardarCitas(appointments);

                await client.sendMessage(from, `✅ ¡Cita confirmada!\nCliente: ${state.userName}\nFecha: ${fechaCita.format('DD/MM')}\nHora: ${fechaCita.format('HH:mm')}\n\nTe avisaremos antes de tu cita.`);
                userState[from] = null;
            } else {
                await client.sendMessage(from, "⚠️ Formato inválido. Intenta de nuevo: Día, Mes Hora:Min\nEjemplo: 15, 03 14:30");
            }
            break;
    }
});

// --- SISTEMA DE AVISOS (CRON) CADA 1 MINUTO ---
cron.schedule('* * * * *', () => {
    const ahora = moment();
    let huboCambios = false;

    appointments.forEach(cita => {
        const diffMinutos = cita.fecha.diff(ahora, 'minutes');

        // Aviso 1 hora antes (entre 60 y 55 minutos)
        if (diffMinutos <= 60 && diffMinutos > 50 && !cita.notificado1h) {
            client.sendMessage(cita.numero, `📌 *RECORDATORIO:* ${cita.cliente}, tu cita está programada para dentro DE 1 HORA!!!`);
            cita.notificado1h = true;
            huboCambios = true;
        }
        
// Aviso media hora antes (entre 30 y 25 minutos)
        if (diffMinutos <= 30 && diffMinutos > 20 && !cita.notificado30m) {
            client.sendMessage(cita.numero, `📌 *RECORDATORIO:* ${cita.cliente}, tu cita está programada para dentro de MEDIA HORA!!!`);
            cita.notificado30m = true;
            huboCambios = true;
        }
    });

    if (huboCambios) {
        guardarCitas(appointments);
    }
});

client.initialize();