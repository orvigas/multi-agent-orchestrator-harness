export const REFINEMENT_QUESTIONS = [
  {
    id: 'functionality',
    text: '¿Para qué funcionalidad o módulo es esto?',
    hint: 'Ej: módulo de autenticación, carrito de compras, etc.',
    optional: true,
  },
  {
    id: 'useCases',
    text: '¿Cuáles son los casos de uso específicos? (separados por comas)',
    hint: 'Ej: Usuario puede login, usuario puede logout, usuario puede resetear contraseña',
    optional: true,
  },
  {
    id: 'priority',
    text: '¿Cuál es la prioridad? (low/normal/high/critical)',
    hint: 'Crítica = bloqueador, Alta = importante para usuario, Normal = mejora, Baja = nice-to-have',
    optional: true,
  },
  {
    id: 'restrictions',
    text: '¿Hay restricciones o dependencias? (separadas por comas)',
    hint: 'Ej: Necesita API de Google, No puede tocar auth.ts, Debe usar Jest',
    optional: true,
  },
  {
    id: 'beneficiaries',
    text: '¿Quién son los usuarios beneficiados?',
    hint: 'Ej: Usuarios nuevos, Usuarios móviles, Team de frontend',
    optional: true,
  },
];

export const CONFIRMATION_QUESTIONS = [
  {
    id: 'divide',
    text: '¿Quieres dividir esto en tareas más pequeñas?',
    hint: 'Recomendado si es una tarea muy grande (xlarge)',
    options: ['sí', 'no'],
  },
  {
    id: 'approve',
    text: '¿Apruebas estos tickets?',
    hint: 'Una vez aprobados se guardarán en backlog y están listos para ejecutar',
    options: ['sí', 'no'],
  },
];

export function formatQuestion(question: (typeof REFINEMENT_QUESTIONS)[0]): string {
  let formatted = `\n❓ ${question.text}`;
  if (question.hint) {
    formatted += `\n   💡 ${question.hint}`;
  }
  if (question.optional) {
    formatted += `\n   (Opcional - presiona Enter para saltar)`;
  }
  formatted += '\n> ';
  return formatted;
}

export function formatConfirmation(question: (typeof CONFIRMATION_QUESTIONS)[0]): string {
  let formatted = `\n❓ ${question.text}`;
  if (question.hint) {
    formatted += `\n   💡 ${question.hint}`;
  }
  if (question.options) {
    formatted += `\n   Opciones: ${question.options.join(' / ')}`;
  }
  formatted += '\n> ';
  return formatted;
}
