const express = require('express');
const cors = require('cors');

const pacientesRoutes = require('./routes/pacientes');
const medicosRoutes = require('./routes/medicos');
const citasRoutes = require('./routes/citas');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/pacientes', pacientesRoutes);
app.use('/medicos', medicosRoutes);
app.use('/citas', citasRoutes);

app.get('/', (req, res) => {
  res.send('API Hospital Nacional San Rafael - Funcionando correctamente');
});

// Para exportar para testing si se necesita, o arrancar servidor
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
  });
}

module.exports = app;
