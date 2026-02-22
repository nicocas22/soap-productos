const express = require('express')
const soap = require('strong-soap').soap
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}-${m}-${y}`
}

function calcularProductos(productos, hoyISO) {
  const hoy = new Date(hoyISO)
  const porVencer = []
  const vencidos = []

  productos.forEach(producto => {
    const fechaVencimiento = new Date(producto.customerData.FechaVencimiento)
    const diasRetiro = producto.customerData.DiasRetiro || 0
    const diasRestantes = Math.floor((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24))
    const fechaRetiro = new Date(fechaVencimiento)
    fechaRetiro.setDate(fechaRetiro.getDate() - diasRetiro)

    let estado
    if (diasRestantes < 0) {
      estado = 'VENCIDO'
    } else if (hoy >= fechaRetiro) {
      estado = 'CRITICO'
    } else {
      estado = 'NORMAL'
    }

    const productoCalculado = {
      ...producto,
      calculado: {
        diasRestantes,
        fechaRetiro: formatDate(fechaRetiro),
        fechaVencimientoFormateada: formatDate(fechaVencimiento),
        estado
      }
    }

    if (diasRestantes < 0) {
      vencidos.push(productoCalculado)
    } else if (hoy >= fechaRetiro) {
      porVencer.push(productoCalculado)
    }
    // NORMAL no se incluye
  })

  return { porVencer, vencidos }
}

const serviceObject = {
  ProductosService: {
    ProductosPort: {
      calcularProductos: function (args) {
        try {
          const productos = JSON.parse(args.productosJson)
          const hoyISO = args.hoyISO

          console.log(`[SOAP] calcularProductos → ${productos.length} productos, hoy: ${hoyISO}`)

          const resultado = calcularProductos(productos, hoyISO)

          console.log(`[SOAP] porVencer: ${resultado.porVencer.length} | vencidos: ${resultado.vencidos.length}`)

          return { return: JSON.stringify(resultado) }
        } catch (err) {
          console.error('[SOAP] Error:', err.message)
          return { return: JSON.stringify({ error: err.message }) }
        }
      }
    }
  }
}

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'soap-productos', wsdl: '/productos?wsdl' })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)

  const wsdl = fs.readFileSync(path.join(__dirname, 'productos.wsdl'), 'utf8')

  soap.listen(app, '/productos', serviceObject, wsdl, () => {
    console.log(`WSDL disponible en: http://localhost:${PORT}/productos?wsdl`)
  })
})