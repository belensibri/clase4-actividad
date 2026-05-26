const express = require('express');
const { z } = require('zod');
const db = require('../data/db');
const crypto = require('crypto');

const router = express.Router();

const pacienteSchema = z.object({
  dui: z.string().min(1, "El DUI es obligatorio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  tipoSangre: z.string().optional(),
  alergias: z.string().optional(),
  contactoEmergencia: z.string().optional(),
  seguroMedico: z.string().optional(),
  expediente: z.string().optional(),
});

const entradaExpedienteSchema = z.object({
  citaId: z.string().min(1, "El ID de la cita es obligatorio"),
  descripcion: z.string().min(1, "La descripción o diagnóstico es obligatorio"),
});

// GET /pacientes - list and search
router.get('/', (req, res) => {
  const { nombre, dui, expediente } = req.query;
  
  let resultados = db.pacientes;

  if (nombre || dui || expediente) {
    resultados = resultados.filter(p => {
      const matchNombre = nombre ? p.nombre.toLowerCase().includes(nombre.toLowerCase()) : true;
      const matchDui = dui ? p.dui.toLowerCase().includes(dui.toLowerCase()) : true;
      const matchExpediente = expediente ? (p.expediente && p.expediente.toLowerCase().includes(expediente.toLowerCase())) : true;
      
      return matchNombre && matchDui && matchExpediente;
    });
  }

  // Si no hay coincidencias se retorna un arreglo vacio [] (no 404)
  res.status(200).json(resultados);
});

// GET /pacientes/:id
router.get('/:id', (req, res) => {
  const paciente = db.pacientes.find(p => p.id === req.params.id);
  if (!paciente) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }
  res.status(200).json(paciente);
});

// POST /pacientes
router.post('/', (req, res) => {
  const result = pacienteSchema.safeParse(req.body);
  if (!result.success) {
    // Retorna error 400 descriptivo
    return res.status(400).json({ errors: result.error.errors });
  }

  const newPaciente = {
    id: crypto.randomUUID(),
    ...result.data
  };

  db.pacientes.push(newPaciente);
  // Responde 201 al crear
  res.status(201).json(newPaciente);
});

// PUT /pacientes/:id
router.put('/:id', (req, res) => {
  const index = db.pacientes.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }

  const result = pacienteSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  db.pacientes[index] = { ...db.pacientes[index], ...result.data };
  // Responde 200 al actualizar
  res.status(200).json(db.pacientes[index]);
});

// DELETE /pacientes/:id
router.delete('/:id', (req, res) => {
  const index = db.pacientes.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }

  db.pacientes.splice(index, 1);
  // Responde 204 al eliminar
  res.status(204).send();
});

// POST /pacientes/:id/expediente - Agregar entrada al expediente
router.post('/:id/expediente', (req, res) => {
  const pacienteId = req.params.id;
  const paciente = db.pacientes.find(p => p.id === pacienteId);
  
  if (!paciente) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }

  const result = entradaExpedienteSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { citaId, descripcion } = result.data;
  const cita = db.citas.find(c => c.id === citaId);

  if (!cita) {
    return res.status(404).json({ error: "La cita asociada no existe" });
  }

  if (cita.paciente !== pacienteId) {
    return res.status(400).json({ error: "La cita no pertenece a este paciente" });
  }

  if (cita.estado !== 'completada') {
    return res.status(422).json({ error: "Solo se pueden agregar entradas de citas completadas" });
  }

  const nuevaEntrada = {
    id: crypto.randomUUID(),
    pacienteId,
    citaId,
    descripcion,
    fecha: new Date().toISOString()
  };

  db.historial.push(nuevaEntrada);
  res.status(201).json(nuevaEntrada);
});

// GET /pacientes/:id/expediente - Historial clínico completo
router.get('/:id/expediente', (req, res) => {
  const pacienteId = req.params.id;
  const pacienteExists = db.pacientes.some(p => p.id === pacienteId);

  if (!pacienteExists) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }

  const entradas = db.historial
    .filter(h => h.pacienteId === pacienteId)
    .map(h => {
      const cita = db.citas.find(c => c.id === h.citaId);
      const medico = db.medicos.find(m => m.id === cita?.medico);
      return { ...h, cita, medico };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  res.status(200).json(entradas);
});

module.exports = router;
