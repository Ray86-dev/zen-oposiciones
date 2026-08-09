export const CONSEJOS: Record<string, string[]> = {
  F1: [
    "Tus temas son de 2021. Antes de memorizar nada, actualiza la fundamentación normativa a la LOMLOE: competencias específicas, criterios de evaluación y saberes básicos.",
    "Define ahora tu plantilla de tema: índice, introducción, 4-5 epígrafes, conclusión personal y bibliografía. La rúbrica premia la estructura con 1,5 puntos antes de escribir una sola idea.",
    "Escribe a mano desde el primer día. La prueba son 2 h 30 con bolígrafo azul: la mano se entrena como cualquier músculo.",
    "Cronometra cuánto tardas en escribir un folio a mano. Ese número decide cuántos folios puedes plantear en el examen.",
  ],
  F2: [
    "Un tema no está estudiado hasta que puedes reconstruir su índice de memoria en dos minutos.",
    "Cada tema necesita un autor citable, una referencia bibliográfica y un anclaje contemporáneo: son 1,25 puntos de la rúbrica que casi nadie trabaja.",
    "El apartado de originalidad vale 1,5 puntos. Ten preparados tres o cuatro puentes con problemas actuales (IA, crisis climática, posverdad, redes) que puedas injertar en muchos temas.",
    "Si un tema se te resiste, no lo saltes: redúcelo a un esquema de una cara y sigue. Volverás en la segunda vuelta.",
  ],
  F3: [
    "La Parte B vale el 50 % de la nota y depende de un documento que preparas con calma en casa. Es la parte más rentable de toda la oposición.",
    "En la UD, el DUA vale 0,8 puntos y los elementos transversales 0,4. Que no sean un párrafo de relleno: concrétalos en actividades.",
    "Incluye aprendizajes, recursos o contextos canarios de forma explícita: es un ítem propio de la rúbrica (0,25 puntos).",
    "Ensaya la defensa oral en voz alta y con reloj. La distribución del tiempo puntúa por sí sola.",
  ],
  F4: [
    "Simulacro completo cada semana: 2 h 30, a mano, sin apuntes, con el guion oficial de cuatro apartados.",
    "Corrige tus simulacros con la plantilla del tribunal, ítem por ítem. Verás que pierdes puntos en cosas mecánicas, no en filosofía.",
    "Repasa por índices, no por texto: a estas alturas necesitas recuperar estructuras, no releer.",
    "Prepara el material físico: bolígrafos azules de repuesto, DNI, las dos copias de la UD en su sobre abierto.",
  ],
};

export function consejoDe(faseId: string, semilla: number): string {
  const lista = CONSEJOS[faseId] ?? CONSEJOS.F2;
  return lista[semilla % lista.length];
}
