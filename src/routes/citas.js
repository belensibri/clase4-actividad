const express = require('express');
const { z } = require('zod');
const db = require('../data/db');
const crypto = require('crypto');

const router = express.Router();

const citaSchema = z.object({
  paciente: z.string().min(1, "El paciente es obligatorio"),
  medico: z.string().min(1, "El médico es obligatorio"),
  fechaHora: z.string().refine(val => !isNaN(Date.parse(val)), "Fecha y hora inválidas"),
  motivo: z.string().min(1, "El motivo es obligatorio")
});

const estadoSchema = z.object({
  estado: z.string().min(1, "El estado es obligatorio")
});

// GET /citas/hoy
router.get('/hoy', (req, res) => {
  const hoy = new Date();
  const dateString = hoy.toISOString().split('T')[0];

  const citasDeHoy = db.citas.filter(c => {
    return c.fechaHora.startsWith(dateString);
  });

  const agrupado = {};
  for (const cita of citasDeHoy) {
    const dep = cita.departamento || 'Sin asignar';
    if (!agrupado[dep]) {
      agrupado[dep] = {
        count: 0,
        citas: []
      };
    }
    agrupado[dep].count += 1;
    agrupado[dep].citas.push(cita);
  }

  res.status(200).json(agrupado);
});

// POST /citas
router.post('/', (req, res) => {
  const result = citaSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { paciente, medico, fechaHora, motivo } = result.data;

  const medicoObj = db.medicos.find(m => m.id === medico);
  if (!medicoObj) {
    return res.status(400).json({ error: "El médico no existe" });
  }

  if (medicoObj.estado !== 'activo' && medicoObj.estado !== 'guardia') {
    return res.status(400).json({ error: "El médico no está activo o de guardia" });
  }

  const conflicto = db.citas.find(c => c.medico === medico && c.fechaHora === fechaHora);
  if (conflicto) {
    return res.status(409).json({ error: "El médico ya tiene otra cita en el mismo horario" });
  }

  const nuevaCita = {
    id: crypto.randomUUID(),
    paciente,
    medico,
    fechaHora,
    motivo,
    estado: "programada",
    departamento: medicoObj.departamento || "General"
  };

  db.citas.push(nuevaCita);
  res.status(201).json(nuevaCita);
});

// PATCH /citas/:id/estado
router.patch('/:id/estado', (req, res) => {
  const result = estadoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const index = db.citas.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Cita no encontrada" });
  }

  const citaActual = db.citas[index];
  const nuevoEstado = result.data.estado;

  if (citaActual.estado === 'completada' || citaActual.estado === 'cancelada') {
    return res.status(422).json({ 
      error: `La cita ya está ${citaActual.estado} y no puede ser modificada.`,
      estadoActual: citaActual.estado,
      estadosPermitidos: []
    });
  }

  const validTransitions = {
    'programada': ['en curso', 'cancelada'],
    'en curso': ['completada']
  };

  const allowed = validTransitions[citaActual.estado] || [];
  if (!allowed.includes(nuevoEstado)) {
    return res.status(422).json({
      error: "Transición de estado inválida",
      estadoActual: citaActual.estado,
      estadosPermitidos: allowed
    });
  }

  db.citas[index].estado = nuevoEstado;
  res.status(200).json(db.citas[index]);
});

module.exports = router;
