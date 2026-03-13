const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const P = require("pino")
const fs = require("fs")

console.log("Iniciando bot barbería...")

const citasFile = "citas.json"

if (!fs.existsSync(citasFile)) {
    fs.writeFileSync(citasFile, JSON.stringify([]))
}

async function startBot() {

const { state, saveCreds } = await useMultiFileAuthState("session")

const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state
})

sock.ev.on("connection.update", async (update) => {

const { connection, lastDisconnect } = update

if(connection === "connecting"){
    console.log("Conectando a WhatsApp...")
}

if(connection === "open"){
    console.log("Bot conectado a WhatsApp ✅")
}

if(connection === "close"){
    console.log("Conexion cerrada, intentando reconectar...")
}

})

/* CODIGO PARA VINCULAR WHATSAPP */

if(!state.creds.registered){

const numero = "50232169058" // tu numero

setTimeout(async () => {

const code = await sock.requestPairingCode(numero)

console.log("Codigo para vincular WhatsApp:")
console.log(code)

}, 5000)

}

    sock.ev.on("connection.update", ({ connection, qr }) => {

       

    })

    let estados = {}

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]

        if (!msg.message) return

        const from = msg.key.remoteJid

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text

        if (!text) return

        if (!estados[from]) {

            if (text.toLowerCase() === "hola" || text === "menu") {

                estados[from] = { paso: "menu" }

                return sock.sendMessage(from, {
                    text: `💈 *Barbería*

1️⃣ Agendar cita
2️⃣ Ver precios`
                })
            }

            return
        }

        const estado = estados[from]

        if (estado.paso === "menu") {

            if (text === "1") {

                estado.paso = "nombre"

                return sock.sendMessage(from, {
                    text: "Escribe tu *nombre y apellido*"
                })
            }

            if (text === "2") {

                return sock.sendMessage(from, {
                    text: `💈 Precios

Corte: Q20.00 A veces depende del tipo de corte
Barba: Q15.00 A veces depende del tipo de barba
Corte + Barba: Q30.00 A veces depende del tipo de corte y barba`
                })
            }

        }

        if (estado.paso === "nombre") {

            estado.nombre = text
            estado.paso = "fecha"

            return sock.sendMessage(from, {
                text: "¿Qué *fecha* deseas?\nEjemplo: 25/03/2026"
            })
        }

        if (estado.paso === "fecha") {

            estado.fecha = text
            estado.paso = "hora"

            return sock.sendMessage(from, {
                text: "¿Qué *hora* deseas?\nEjemplo: 10:00"
            })
        }

        if (estado.paso === "hora") {

            let citas = JSON.parse(fs.readFileSync(citasFile))

            let ocupado = citas.find(c =>
                c.fecha === estado.fecha && c.hora === text
            )

            if (ocupado) {

                return sock.sendMessage(from, {
                    text: "❌ Ese horario ya está ocupado"
                })
            }

            const cita = {
                nombre: estado.nombre,
                fecha: estado.fecha,
                hora: text,
                telefono: from
            }

            citas.push(cita)

            fs.writeFileSync(citasFile, JSON.stringify(citas, null, 2))

            delete estados[from]

            return sock.sendMessage(from, {
                text: `✅ *Cita confirmada*

Cliente: ${cita.nombre}
Fecha: ${cita.fecha}
Hora: ${cita.hora}`
            })

        }

    })

}

startBot()

setInterval(() => {
    console.log("Bot activo...")
}, 30000)