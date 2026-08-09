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

## Datos

| Archivo | Contenido |
|---|---|
| `data/temario-filosofia.json` | Los 71 temas, bloques y mapeo a tus archivos de Drive |
| `data/rubricas.json` | Plantillas oficiales de corrección (Parte A y Parte B) |
| `data/supuestos.json` | Supuestos prácticos reales 2025 + guiones oficiales |
| `AUDITORIA.md` | Estado real de tu material de estudio |

Todo verificado contra las fuentes oficiales: la suma de los ítems de cada apartado de la
rúbrica cuadra exactamente con su puntuación, y los 71 temas cuadran con los bloques.

## Dónde vive cada cosa

| Capa | Dónde | Por qué |
|---|---|---|
| Interfaz | GitHub Pages (estático) | Gratis y sin servidor que mantener |
| Cuentas y datos | Supabase (Postgres + Auth) | RLS por usuario en todas las tablas |
| Claves de IA | Secretos de Edge Functions | **Nunca** en el navegador |

Esto último no es un detalle. GitHub Pages sirve archivos estáticos: cualquier clave que
estuviera en el bundle sería legible por quien abriera el código fuente. Por eso las llamadas
a DeepSeek y a Gemini pasan por dos Edge Functions que exigen sesión iniciada, aplican un
cupo diario por usuario y guardan lo generado.

La clave publicable de Supabase sí está en el bundle: es pública por diseño y lo que protege
los datos es el RLS.

### Modelos

| Función | Modelo | Para qué |
|---|---|---|
| `generar-material` | `deepseek-v4-flash` | Esquemas, resúmenes, tema de examen |
| `generar-material` | `gemini-3.6-flash` | Guías, flashcards, preguntas, mapas |
| `generar-supuesto` | `deepseek-v4-flash` | Supuestos prácticos nuevos |

Ambos configurables con las variables `DEEPSEEK_MODEL` y `GEMINI_MODEL`.

## Puesta en marcha del backend

```bash
# 1. Secretos de IA (en el panel de Supabase → Edge Functions → Secrets)
DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...

# 2. Subir el índice y el texto de los 71 temas
$env:SUPABASE_SERVICE_ROLE_KEY="..." ; npm run subir-contenido
```

El contenido de los temas no está en el repositorio: es material propio y ocupa 8,2 MB.
Vive en `_fuentes/temas-html.json`, fuera del proyecto.

## Escalar a otras especialidades

El esquema de Supabase ya es multi-especialidad: todo cuelga de `public.temarios`, con RLS
por usuario en `planes`, `progreso_temas`, `sesiones_estudio` e `intentos_supuesto`. El
proyecto ya tenía `profiles`, `purchases` y `subscriptions`, así que la capa de cobro
existe.

Para añadir una especialidad: un `INSERT` en `temarios` + un JSON de temas con la misma
forma. El motor de planificación no necesita ningún cambio.

```bash
cp .env.local.example .env.local     # rellenar con las claves del proyecto
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
```

## Verificación

```bash
npm run build      # compilación de producción (79 páginas)
npm run smoke      # monta las páginas en un DOM real y comprueba el contenido
```

Antes de cada publicación conviene comprobar que no se ha colado ninguna clave:

```powershell
Get-ChildItem out -Recurse -File | Select-String -Pattern "sk-","AIzaSy","service_role"
```

## Aviso importante

La fecha de la prueba (**19 de junio de 2027**) es una estimación a partir de las
convocatorias anteriores (22 jun 2024, 21 jun 2025). Ajústala en Ajustes en cuanto se
publique la convocatoria.

Las rúbricas incluidas son las de 2024. En 2025 la Parte A pasó a ser un supuesto
práctico. Los criterios de cada año se publican en el Portal del Aspirante tres días antes
de la prueba, y las plantillas 24 horas antes.
