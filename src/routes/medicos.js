const express = require('express');
const { z } = require('zod');
const db = require('../data/db');
const crypto = require('crypto');

const router = express.Router();

const medicoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  especialidad: z.string().min(1, "La especialidad es obligatoria"),
  departamento: z.string().optional(),
  horarioAtencion: z.string().optional(),
  estado: z.enum(['activo', 'guardia', 'fuera de servicio']).optional(),
});

// Helper para convertir "8:00 AM" a minutos (ej: 480)
const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// GET /medicos
router.get('/', (req, res) => {
  const { especialidad, horaDesde, horaHasta } = req.query;
  
  let resultados = db.medicos.filter(m => m.estado !== 'fuera de servicio');

  // Si no hay query params, solo retornar activos
  if (!especialidad && !horaDesde && !horaHasta) {
    resultados = resultados.filter(m => m.estado === 'activo');
    return res.status(200).json(resultados);
  }

  if (especialidad) {
    resultados = resultados.filter(m => 
      m.especialidad.toLowerCase().includes(especialidad.toLowerCase())
    );
  }

  if (horaDesde || horaHasta) {
    const desdeMin = timeToMinutes(horaDesde);
    const hastaMin = timeToMinutes(horaHasta);

    resultados = resultados.filter(m => {
      if (!m.horarioAtencion) return false;
      const [startStr, endStr] = m.horarioAtencion.split(' - ');
      const medStart = timeToMinutes(startStr);
      const medEnd = timeToMinutes(endStr);

      let cumple = true;
      if (desdeMin !== null) cumple = cumple && (medStart <= desdeMin);
      if (hastaMin !== null) cumple = cumple && (medEnd >= hastaMin);
      
      return cumple;
    });
  }

  res.status(200).json(resultados);
});

// GET /medicos/:id
router.get('/:id', (req, res) => {
  const medico = db.medicos.find(m => m.id === req.params.id);
  if (!medico) {
    return res.status(404).json({ error: "Médico no encontrado" });
  }
  res.status(200).json(medico);
});

// POST /medicos
router.post('/', (req, res) => {
  const result = medicoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const newMedico = {
    id: crypto.randomUUID(),
    ...result.data
  };

  db.medicos.push(newMedico);
  res.status(201).json(newMedico);
});

// PUT /medicos/:id
router.put('/:id', (req, res) => {
  const index = db.medicos.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Médico no encontrado" });
  }

  const result = medicoSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  db.medicos[index] = { ...db.medicos[index], ...result.data };
  res.status(200).json(db.medicos[index]);
});

// DELETE /medicos/:id
router.delete('/:id', (req, res) => {
  const medicoId = req.params.id;
  const index = db.medicos.findIndex(m => m.id === medicoId);
  
  if (index === -1) {
    return res.status(404).json({ error: "Médico no encontrado" });
  }

  // Validar si tiene citas activas (no completadas ni canceladas)
  const tieneCitasActivas = db.citas.some(
    c => c.medico === medicoId && c.estado !== 'completada' && c.estado !== 'cancelada'
  );
  
  if (tieneCitasActivas) {
    return res.status(400).json({ error: "No se puede eliminar el médico porque tiene citas activas asignadas." });
  }

  db.medicos.splice(index, 1);
  res.status(204).send();
});

module.exports = router;
