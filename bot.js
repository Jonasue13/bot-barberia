const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const { DisconnectReason } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const P = require("pino")
const fs = require("fs")

const citasFile = "citas.json"

if(!fs.existsSync(citasFile)){
    fs.writeFileSync(citasFile, JSON.stringify([]))
}

async function startBot(){

const { state, saveCreds } = await useMultiFileAuthState("session")

const sock = makeWASocket({
logger: P({ level: "silent" }),
auth: state
})

sock.ev.on("creds.update", saveCreds)

sock.ev.on("connection.update", (update) => {

const { connection, qr } = update

if(qr){
qrcode.generate(qr,{small:true})
}

if(connection === "open"){
console.log("Bot conectado")
}

})

let estados = {}

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0]

if(!msg.message) return

const from = msg.key.remoteJid

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text

if(!text) return

if(!estados[from]){

if(text.toLowerCase() === "hola" || text === "menu"){

estados[from] = { paso:"menu" }

return sock.sendMessage(from,{
text:`💈 Barbería

1️⃣ Agendar cita
2️⃣ Ver horarios disponibles
3️⃣ Precios`
})

}

return
}

const estado = estados[from]

if(estado.paso === "menu"){

if(text === "1"){

estados[from].paso = "nombre"

return sock.sendMessage(from,{text:"¿Cuál es tu nombre?"})
}

if(text === "2"){

const citas = JSON.parse(fs.readFileSync(citasFile))

let horarios = []

for(let h=9; h<19; h++){

let hora = `${h}:00`

let ocupado = citas.find(c=>c.hora === hora)

if(!ocupado){
horarios.push(hora)
}

}

return sock.sendMessage(from,{
text:`Horarios disponibles:\n${horarios.join("\n")}`
})

}

if(text === "3"){

return sock.sendMessage(from,{
text:`💈 Precios

Corte: $10
Barba: $5
Corte + Barba: $15`
})

}

}

if(estado.paso === "nombre"){

estado.nombre = text
estado.paso = "hora"

return sock.sendMessage(from,{
text:"¿Qué hora deseas? (ejemplo 10:00)"
})

}

if(estado.paso === "hora"){

let citas = JSON.parse(fs.readFileSync(citasFile))

let ocupado = citas.find(c=>c.hora === text)

if(ocupado){

return sock.sendMessage(from,{
text:"❌ Esa hora ya está ocupada"
})

}

const cita = {
nombre: estado.nombre,
hora: text,
telefono: from
}

citas.push(cita)

fs.writeFileSync(citasFile, JSON.stringify(citas,null,2))

delete estados[from]

return sock.sendMessage(from,{
text:`✅ Cita confirmada
Hora: ${text}`
})

}

})

}

startBot()