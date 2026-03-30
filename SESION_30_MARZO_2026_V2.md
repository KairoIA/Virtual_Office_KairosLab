# KAIROS LAB — Virtual Office
## Sesion 30 Marzo 2026 — V2 (Tarde/Noche)

---

## RESUMEN

Sesion enfocada en sistema de proyectos (tipos, tareas inline, completar), day plan multi-item, correccion de bugs, mejora del briefing matinal con prioridades, y journal nocturno automatico. V8 → V9.

---

## CAMBIOS PRINCIPALES

### 1. Eliminacion de "siguiente accion" en proyectos
- Campo `next_action` eliminado de: project cards, modal, backend routes, AI functions (create_project, update_project), morning briefing, weekly/monthly reviews, state injection, agenda, day sessions builder
- **Archivos:** `js/projects.js`, `index.html`, `backend/routes/projects.js`, `backend/services/functions.js`, `backend/services/functionExecutor.js`, `backend/services/ai.js`, `backend/services/morningBriefing.js`, `backend/services/weeklyReview.js`

### 2. Tareas dentro de proyectos
- Panel de tareas inline en cada project card (boton ☑)
- Crear tarea con texto + deadline (date picker)
- Completar tarea: se queda visible (tachada, opaca) con boton 🔄 retry
- Editar tarea: inline con input texto + date picker deadline
- Eliminar tarea con ✖
- Tareas completadas registran en historial `completed` con fecha
- `Storage.refresh()` al completar para evitar cache stale
- Backend `POST /api/tasks` acepta `project_id`, `deadline`, `category`, `priority`
- **Archivos:** `js/projects.js`, `js/app.js`, `backend/routes/api.js`

### 3. Tipos de proyecto: Temporal vs Permanente
- **Temporal** (default): tiene objetivo final, boton ✅ para completar
- **Permanente**: trabajo continuo, sin boton de completar, Kaira impide marcar como done
- Badge en card: 🎯 Temporal (verde) / ♾ Permanente (morado)
- Selector en modal de crear/editar
- Kaira pregunta tipo si no se especifica
- **Migracion:** `ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'temporal'`
- **Archivos:** `js/projects.js`, `index.html`, `css/main.css`, `backend/routes/projects.js`, `backend/services/functions.js`, `backend/services/functionExecutor.js`

### 4. Kaira pregunta cuando falta info
- Nueva seccion "Preguntas de clarificacion" en system prompt
- Pregunta deadline para tareas, hora para reminders, tipo para proyectos, proyecto destino si ambiguo
- No pregunta si la info es deducible del contexto
- Preguntas breves en estilo paisa natural
- **Archivos:** `backend/services/ai.js`

### 5. Morning briefing mejorado con prioridades
- Tasks separadas: sueltas vs de proyecto (con nombre del proyecto)
- Proyectos muestran tipo (♾/🎯) + tareas pendientes listadas (hasta 3)
- Scan oficina: linea resumen con totales (reminders, tasks, proyectos, inbox, watch later)
- Seccion "Lo mas urgente": ranking por overdue > hoy > deadlines semana > bloqueados > inbox. Top 5.
- **Archivos:** `backend/services/morningBriefing.js`

### 6. Day Plan multi-item por bloque
- **Antes:** 1 item por slot (UNIQUE constraint), upsert sobreescribia
- **Ahora:** multiples items por slot, INSERT (no upsert)
- Constraint `UNIQUE(date_key, slot)` eliminado
- Columna `position` para orden dentro del slot
- Columna `done` (boolean) para tick de completado
- Funciones Kaira actualizadas:
  - `set_day_session`: ahora INSERTA (no reemplaza)
  - `edit_day_session` (nueva): edita item por texto
  - `delete_day_session_item` (nueva): borra item especifico por texto
  - `clear_day_session`: vacia bloque entero
- UI dashboard: cada item tiene ⬜/✅ tick + ✖ eliminar
- Items completados: opacidad baja + focus tachado
- Build Plan limpia slots antes de reconstruir
- AI puede generar 1-3 items por slot
- **Migraciones:**
  ```sql
  ALTER TABLE day_sessions DROP CONSTRAINT day_sessions_date_key_slot_key;
  ALTER TABLE day_sessions ADD COLUMN position INTEGER DEFAULT 1;
  ALTER TABLE day_sessions ADD COLUMN done BOOLEAN DEFAULT false;
  ```
- **Archivos:** `backend/routes/daySessions.js`, `backend/services/functionExecutor.js`, `backend/services/functions.js`, `backend/services/ai.js`, `backend/services/morningBriefing.js`, `js/hq.js`, `js/app.js`, `css/main.css`

### 7. "Early night" = slot "night" (fix)
- Kaira no entendia "early night" → lo ponia en evening
- Descripcion de `set_day_session` actualizada con mapeo explicito
- Prompt de Kaira incluye la equivalencia
- **Archivos:** `backend/services/functions.js`, `backend/services/ai.js`

### 8. Añadir tareas desde pestaña Tasks
- Barra de creacion: input texto + date picker + selector categoria + boton "+"
- Enter para añadir rapido
- Backend acepta `category` y `deadline` en POST
- **Archivos:** `js/tasksView.js`, `index.html`, `css/main.css`, `backend/routes/api.js`

### 9. Fix radar HQ: completaba item equivocado
- **Bug:** `indexOf(r)` buscaba por referencia de objeto spread → devolvia -1 → borraba item incorrecto
- **Fix:** `findIndex(item => item.id === r.id)` busca por ID real
- **Archivos:** `js/hq.js`

### 10. Audit de codigo y fixes de mantenimiento
- **Route ordering daySessions.js:** rutas `/clear/:date` y `/clear/:date/:slot` movidas ANTES de `/:id` (antes eran inalcanzables)
- **tasksView edit mejorado:** ahora edita texto + deadline + categoria (antes solo texto)
- **API tasks:** POST y PUT aceptan `priority`
- **Dead code eliminado:** `togglePlanDone` (referencia vieja a `/api/top3/`) y `renderGenTasks` (nunca existio)
- **Archivos:** `backend/routes/daySessions.js`, `backend/routes/api.js`, `js/tasksView.js`, `js/hq.js`, `js/app.js`

### 11. Journal nocturno automatico (23:59 Madrid)
- Nuevo servicio `nightlyJournal.js` — cron a las 23:59 hora Madrid
- Escanea TODA la actividad del dia: completed, day plan (done/not done), project notes, inbox procesado, activity log, gastos, contenido guardado
- Si el usuario ya escribio journal → Kaira COMPLEMENTA sin repetir (añade seccion "Reporte automatico Kaira")
- Si no hay journal → Kaira genera reporte narrativo completo del dia
- Usa Claude Haiku, tono profesional-paisa, 2-4 parrafos narrativos
- Notifica via Telegram cuando esta listo
- **Archivos:** `backend/services/nightlyJournal.js` (nuevo), `backend/server.js`

---

## MIGRACIONES BD (ejecutadas manualmente en Supabase SQL Editor)

```sql
-- V9a: Tipo de proyecto
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'temporal';

-- V9b: Day sessions multi-item
ALTER TABLE day_sessions DROP CONSTRAINT IF EXISTS day_sessions_date_key_slot_key;
ALTER TABLE day_sessions ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 1;

-- V9c: Day sessions tick
ALTER TABLE day_sessions ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false;
```

---

## ARCHIVOS NUEVOS
- `backend/services/nightlyJournal.js` — Cron journal nocturno 23:59

## ARCHIVOS MODIFICADOS
- `index.html` — Modal proyecto (type selector, sin next_action), barra añadir tasks
- `css/main.css` — Project type badge, session tick/done, task deadline badge, add bar styles
- `js/projects.js` — Sin next_action, tareas inline (CRUD+tick+edit+deadline), tipos, completeProject
- `js/hq.js` — Multi-item sessions, tick done, fix radar indexOf, dead code eliminado
- `js/tasksView.js` — Barra añadir tarea, edit con deadline+category
- `js/app.js` — Imports actualizados (toggleSessionDone, nuevas funciones proyecto)
- `js/storage.js` — Sin cambios directos pero refresh usado mas
- `backend/server.js` — Import + start nightlyJournal
- `backend/routes/api.js` — Tasks POST/PUT con deadline, category, priority
- `backend/routes/projects.js` — project_type en create/update
- `backend/routes/daySessions.js` — Reescrito: POST para añadir, route ordering fix, PUT con done
- `backend/services/functions.js` — Sin next_action, project_type, set/edit/delete/clear day session, focus_text required
- `backend/services/functionExecutor.js` — Sin next_action, project_type, INSERT day sessions, edit/delete session items, permanent projects can't be done
- `backend/services/ai.js` — Preguntas clarificacion, day sessions info, multi-item build prompt, clear before build
- `backend/services/morningBriefing.js` — Tasks por proyecto, scan oficina, ranking urgencia, clear before build
- `backend/services/weeklyReview.js` — Sin next_action

---

## KAIRA FUNCIONES (ahora 46)
Nuevas respecto a V8:
- `clear_day_session` — Vaciar bloque entero del day plan
- `edit_day_session` — Editar item del day plan por texto
- `delete_day_session_item` — Borrar item especifico del day plan
- Kaira pregunta info faltante (deadline, hora, tipo proyecto, categoria)

## SERVICIOS AUTOMATIZADOS (ahora 8)
- Morning Briefing (08:00 CET via Telegram)
- Weekly Review (Domingos 20:00 CET)
- Monthly Review (Ultimo dia del mes 20:00 CET)
- Recurring Reminders (00:05 UTC daily)
- Reminder Alerts (cada 60s, Telegram 30min antes)
- Midnight Cleanup (00:00 Madrid, limpia day_sessions)
- Behavioral Intelligence (memoria persistente, semanal)
- **Nightly Journal (23:59 Madrid, reporte diario automatico)** NUEVO

---

### 12. Git push + deploy script
- `deploy.sh`: ejecuta smoke test → git add → commit → push. Uso: `bash deploy.sh "mensaje"`
- `.gitignore` actualizado: excluye `.env`, `*.mp3`, `*.wav`, `separate_voices.py` (contenia HF token)
- Repo actualizado: github.com/KairoIA/Virtual_Office_KairosLab (commit 57b5b0a)
- **Archivos:** `deploy.sh` (nuevo), `.gitignore`

### 13. Smoke test
- `backend/smoke-test.js`: testea 13 endpoints GET + 1 ciclo CRUD (POST+DELETE tasks)
- Se ejecuta automaticamente antes de cada deploy
- Exit code 0 si todo pasa, 1 si falla algo
- **Archivos:** `backend/smoke-test.js` (nuevo)

### 14. Analytics reales en pestaña Stats
- Backend `GET /api/stats`: endpoint agregado que calcula todo en una query
  - Completados por dia (7d), por dominio, comparacion vs semana anterior
  - Day plan ratio (done/total), rendimiento por slot
  - Horas por dominio (basado en slots completados × duracion)
  - Streak de dias consecutivos productivos (ultimos 30d)
  - Tasks pendientes por categoria, proyectos por estado
- Frontend reescrito con charts CSS:
  - Grafico de barras vertical: completados por dia (7d) con highlight en hoy
  - Barras horizontales: horas por dominio con colores
  - 4 cards de rendimiento por bloque (morning/afternoon/evening/night %)
  - Barras: tasks pendientes por categoria, proyectos por estado
  - Stat cards: completados (+% delta), streak, plan ratio, pending tasks, proyectos activos, Kaira AI cost
- Semana empieza en Monday (Mon-Tue-Wed-Thu-Fri-Sat-Sun)
- **Archivos:** `backend/routes/stats.js` (nuevo), `backend/server.js`, `js/stats.js` (reescrito), `index.html`, `css/main.css`

### 15. Kaira FAB draggable + panel redimensionable
- **Laptop:** click+mantener+arrastrar mueve la pompa. Click corto (<10px) abre chat. Autofocus en input al abrir.
- **Movil:** tap abre chat (sin abrir teclado). Hold+arrastrar mueve pompa. Sin resize handle.
- Panel redimensionable en laptop: handle diagonal en esquina superior izquierda (↖). Arrastra para cambiar width+height.
- X cierra siempre (forceClose).
- Teclado movil: `visualViewport` API reposiciona panel encima del teclado cuando se abre.
- **Archivos:** `js/app.js`, `css/assistant.css`, `index.html`

### 16. PWA icon fix
- Iconos regenerados desde `logo_web_original.png` (circular, sin esquinas blancas)
- Versiones maskable con padding 72% sobre fondo negro `#050505`
- Versiones regular al 92% sobre fondo negro
- Manifest actualizado: `any` y `maskable` apuntan a archivos separados
- **Archivos:** `manifest.json`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-192-maskable.png` (nuevo), `assets/icon-512-maskable.png` (nuevo)

---

## ARCHIVOS NUEVOS (adicionales)
- `deploy.sh` — Script de deploy (smoke test + git push)
- `backend/smoke-test.js` — Health check de 14 endpoints
- `backend/routes/stats.js` — API analytics agregada

## ARCHIVOS MODIFICADOS (adicionales)
- `.gitignore` — Excluye audio, secrets
- `backend/server.js` — Import + mount stats router

---

## PENDIENTE
- Habit tracker
- Quick capture widget
- MT5 dashboard integration
- Polymarket tracker
- Push notifications (PWA)
