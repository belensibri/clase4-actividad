const db = {
  pacientes: [
    {
      id: "1",
      dui: "12345678-9",
      nombre: "Juan Perez",
      tipoSangre: "O+",
      alergias: "Ninguna",
      contactoEmergencia: "Maria Perez - 7777-8888",
      seguroMedico: "Seguro Vida",
      expediente: "EXP-001"
    }
  ],
  medicos: [
    {
      id: "1",
      nombre: "Dr. Roberto Gomez",
      especialidad: "Cardiología",
      departamento: "Medicina Interna",
      horarioAtencion: "8:00 AM - 4:00 PM",
      estado: "activo"
    }
  ],
  citas: [
    {
      id: "1",
      paciente: "1",
      medico: "1", // Este médico tiene una cita activa
      fechaHora: "2024-05-20T10:00:00Z",
      motivo: "Control general",
      estado: "programada",
      departamento: "Medicina Interna"
    }
  ],
  historial: []
};

module.exports = db;
