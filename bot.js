const OpenAI = require("openai")
const cron = require("node-cron")
const openai = new OpenAI({
apiKey: process.env.OPENAI_KEY
})
const { Client, LocalAuth } = require("whatsapp-web.js")
const qrcode = require("qrcode-terminal")
const fs = require("fs")

const client = new Client({
authStrategy: new LocalAuth()
})

let estados = {}

function generarHorarios(){

let horarios=[]
let inicio=9
let fin=19
let minutos=0

while(inicio < fin){

let hora = `${String(inicio).padStart(2,'0')}:${String(minutos).padStart(2,'0')}`

horarios.push(hora)

minutos += 45

if(minutos >= 60){
inicio++
minutos -= 60
}

}

return horarios
}

function obtenerCitas(){

if(!fs.existsSync("citas.json")){
return []
}

return JSON.parse(fs.readFileSync("citas.json"))
}

function guardarCita(cita){

let citas = obtenerCitas()

citas.push(cita)

fs.writeFileSync("citas.json",JSON.stringify(citas,null,2))
}

client.on("qr", qr => {
qrcode.generate(qr,{small:true})
})

client.on("ready", () => {
console.log("Bot listo 💈")
})

client.on("message", async msg => {

const texto = msg.body.toLowerCase()
const numero = msg.from

if(texto === "hola"){

msg.reply(
`💈 *Barbería*

1️⃣ Agendar cita
2️⃣ Ver horarios disponibles`
)

}

if(texto === "1"){
estados[numero]={paso:"nombre"}
msg.reply("¿Cuál es tu nombre y apellido?")
return
}

if(texto === "2"){

let horarios = generarHorarios()
let citas = obtenerCitas()

let ocupados = citas.map(c=>c.hora)

let libres = horarios.filter(h=>!ocupados.includes(h))

msg.reply("Horarios disponibles:\n\n"+libres.join("\n"))
}

if(estados[numero]?.paso==="nombre"){

estados[numero].nombre = msg.body
estados[numero].paso = "fecha"

msg.reply("¿Para qué día deseas la cita? Escribe así: 2026-03-15")

return
}

if(estados[numero]?.paso==="fecha"){

estados[numero].fecha = msg.body
estados[numero].paso = "hora"

let horarios = generarHorarios()

msg.reply("Selecciona la hora:\n\n"+horarios.join("\n"))

return
}

if(estados[numero]?.paso==="hora"){

let citas = obtenerCitas()

if(citas.find(c=>c.hora===msg.body && c.fecha===estados[numero].fecha)){

msg.reply("❌ Ese horario ya está ocupado")
return
}

guardarCita({
nombre: estados[numero].nombre,
fecha: estados[numero].fecha,
hora: msg.body,
telefono: numero
})

delete estados[numero]

msg.reply("✅ Cita agendada correctamente")

}
else{

const respuesta = await openai.chat.completions.create({
model:"gpt-4o-mini",
messages:[
{
role:"system",
content:`
Eres el asistente virtual de una barbería.

Información del negocio:

Corte de cabello: Q20.00 De pende a veces
Corte + barba: Q30.00
Barba: Q15.00

Horario de atención:
9:00 a 19:00


Responde siempre de forma corta, amable y profesional.
Si quieren agendar cita indícales que escriban 1 en el menú.
Siquieren ver horarios disponibles indícales que escriban 2 en el menú.
`
},
{
role:"user",
content: texto
}
]
})

msg.reply(respuesta.choices[0].message.content)

}

})

client.initialize()
cron.schedule("*/30 * * * *", ()=>{

let citas = obtenerCitas()

let ahora = new Date()

citas.forEach(cita=>{

// lógica de recordatorio aquí

cron.schedule("*/10 * * * *", async ()=>{

let citas = obtenerCitas()

let ahora = new Date()

citas.forEach(async cita =>{

let fechaCita = new Date(cita.fecha+" "+cita.hora)

let diff = fechaCita - ahora

let minutos = diff / 60000

if(minutos > 55 && minutos < 65){

await client.sendMessage(
cita.telefono,
`⏰ Recordatorio

Hola ${cita.nombre}
Tienes una cita hoy a las ${cita.hora} 💈`
)

}

})

})

})

})