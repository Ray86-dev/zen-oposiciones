# Zen · Oposiciones de Filosofía

Plan de estudio guiado para el procedimiento selectivo del **Cuerpo de Profesores de
Enseñanza Secundaria, especialidad Filosofía (590/201)** en Canarias, con horizonte
**agosto 2026 → junio 2027**.

Construido para un objetivo concreto — sacar plaza con buena nota — pero con la
arquitectura preparada para abrirlo a otras especialidades.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3000
```

Copia `.env.local.example` a `.env.local` con las claves de Supabase. Sin ellas la app
arranca igual, pero en modo local: sin cuentas, sin lector de temas y sin IA.

## Qué hace

**Hoy** — cuenta atrás, fase actual, sesiones del día, porcentaje de temario consolidado
y la probabilidad real de que salga alguno de tus temas preparados (se sortean 5 de 71).

**Temario** — los 71 temas oficiales con su bloque, cinco estados de avance
(pendiente → leído → esquematizado → memorizado → dominado), enlace directo al documento
en Drive y aviso cuando el material está sin revisar desde 2021.

**Calendario** — el plan completo hasta la prueba, mes a mes, con las cuatro fases y el
detalle de cada día.

**Supuestos** — los enunciados reales del tribunal (2025) con cronómetro de 2 h 30 y
autocorrección ítem por ítem usando la plantilla oficial de corrección.

**Lector** — el texto completo de cada tema dentro de la app, con subrayado en cuatro
colores (idea clave, definición, autor, dudoso) y notas ancladas a un fragmento concreto.
Todo se guarda en tu cuenta, así que te sigue entre dispositivos.

**Generación con IA** — desde el propio lector: esquema, resumen, tema listo para el examen,
guía de estudio, flashcards, autoevaluación y mapa conceptual. Y en Supuestos, un generador
de enunciados nuevos anclado al currículo LOMLOE de Canarias.

**Ajustes** — disponibilidad real por día de la semana, cuenta y tema claro u oscuro. El plan
se recalcula al instante y te dice si tu ritmo llega o no llega.

## Cómo planifica

El motor (`lib/plan.ts`) es una función pura: mismas entradas, mismo plan.

- **Orden de estudio** por *stride scheduling*: cada bloque reparte sus temas de forma
  uniforme, así desde la primera semana avanzas en paralelo por todas las áreas en vez de
  terminar Historia de la Filosofía y no haber tocado Lógica.
- **Esfuerzo por tema** estimado según la extensión real de tu material (90–300 min).
- **Repaso espaciado** a 7, 21 y 60 días de la primera pasada.
- **Vueltas sucesivas**: al cerrar la primera vuelta se abre otra, más rápida (50 %, luego 35 %).
- **Cuatro fases**: Cimientos → Primera vuelta → Programación y UD → Simulacros.
- Supuesto práctico semanal desde la fase 3; simulacro completo de 2 h 30 en la fase 4.

Con el temario actual hacen falta **~11,6 h/semana** para cerrar la primera vuelta en
febrero de 2027. La app te lo avisa si tu disponibilidad se queda corta.
