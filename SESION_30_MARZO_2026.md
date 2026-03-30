# KAIROS LAB — Virtual Office
## Sesion 30 Marzo 2026

---

## RESUMEN

Sesion de nuevas funcionalidades V6-V8. Day Plan estructurado en 4 franjas horarias, notas de proyecto, alertas de reminders por Telegram, pestaña de Lists, fix de swipe inteligente, historial de completados en todas las pestañas, y fix del morning briefing.

---

## CAMBIOS PRINCIPALES

### 1. Swipe inteligente (fix critico)
- **Problema:** al deslizar en filtros de categorias (Watch Later, Tasks, Projects) cambiaba de pestaña en vez de scrollear
- **Solucion:** `swipe.js` reescrito. Detecta si el swipe empieza dentro de un contenedor scrollable (`.projects-filters`, `.tasks-view-filters`, `.library-header`, `.nav-tabs`). Si `scrollWidth > clientWidth`, deja el scroll nativo y no cambia de tab
- Ignora swipes dentro del panel de Kaira
- Filtros ahora con `overflow-x: auto`, `flex-wrap: nowrap`, `white-space: nowrap` en CSS
- **Archivos:** `js/swipe.js`, `css/main.css`

### 2. Pestaña Lists (nueva)
- Kaira guarda listas (compra, packing, custom) pero no habia UI para verlas
- Nueva pestaña entre Tasks y Calendar
- Muestra todas las listas con items, checkbox, contador pending/total
- CRUD completo: crear lista, añadir items, marcar/desmarcar, borrar item, borrar lista
- Conecta con API `/api/lists` existente
- **Archivos:** `js/listsView.js` (nuevo), `index.html`, `js/app.js`, `css/main.css`

### 3. Hora en reminders + alertas Telegram
- Campo `due_time` (TIME) opcional en reminders (migracion V6)
- Campo `alert_sent` (BOOLEAN) para no repetir alertas
- Kaira entiende "a las 3" → guarda `due_time: "15:00"`
- Servicio `reminderAlerts.js`: chequea cada 60s, 30 min antes envia Telegram con estilo paisa
- 7 templates de mensaje aleatorios: "Ey amor! En media horita tienes..."
- Timezone Europe/Madrid
- **Archivos:** `schema_v6.sql`, `services/reminderAlerts.js` (nuevo), `services/functionExecutor.js`, `services/functions.js`, `routes/api.js`, `server.js`

### 4. Fix morning briefing
- **Problema:** `TELEGRAM_CHAT_ID` estaba vacio en `.env` → briefing fallaba silenciosamente al arrancar
- Chat ID auto-detectado y fijado: `1557251818`
- `ensureChatId()` añadido a todos los commands de Telegram (`/start`, `/topics`, `/pending`)
- Retry automatico: si no hay chatId, reintenta en 60s en vez de rendirse
- No envia briefing duplicado en cada restart (tracking `briefingSentToday`)
- Delay de startup subido a 8s para dar tiempo al bot
- **Archivos:** `services/telegram.js`, `services/morningBriefing.js`, `.env`

### 5. Day Plan — 4 sesiones estructuradas (V7)
- **Concepto:** El dia se divide en 4 franjas de trabajo fijas:
  - Morning (08:00-11:30) — deep work
  - Afternoon (11:30-14:30) — management
  - Evening (17:00-19:30) — creative/estudio
  - Early Night (19:30-23:00) — personal/review
- Dominios: Trading, Dev, Bets, IA, Personal, **Estudio** (nuevo — para learning, research, Watch Later, cursos)
- Tabla `day_sessions` con UNIQUE(date_key, slot), upsert por slot
- Kaira detecta necesidades de estudio: keywords en inbox/tasks (investigar, aprender, curso, leer...) + si Watch Later tiene 5+ items
- `build_day_sessions`: analiza toda la office (deadlines, overdue, projects, inbox, watch later) y propone plan
- `set_day_session`: asigna dominio + focus_text + project_id a cada slot
- Boton "Build" en Dashboard → llama a `/api/voice/chat` → Kaira ejecuta build + 4x set automaticamente
- Cron medianoche (00:00 Madrid) limpia sesiones antiguas automaticamente
- Morning briefing: boton "Build my plan" genera sesiones via AI (processAIForDayPlan en ai.js)
- UI: 4 bloques con color por dominio, icono, hora, proyecto vinculado, focus text, boton limpiar
- **Reemplaza:** el viejo "FOR TODAY" de 10 slots genericos
- **Archivos:** `schema_v7.sql`, `routes/daySessions.js` (nuevo), `services/midnightCron.js` (nuevo), `services/functionExecutor.js`, `services/functions.js`, `services/ai.js`, `services/morningBriefing.js`, `js/hq.js`, `index.html`, `css/main.css`, `server.js`

### 6. Project Notes — mini-journal por proyecto
- Tabla `project_notes` (project_id, content, created_at)
- Boton de notas en cada project card → panel expandible con timeline
- Input para añadir notas + boton borrar
- Kaira: `add_project_note` y `get_project_notes` (funciones nuevas)
- `get_project_docs` ahora incluye project_notes en el output
- **Archivos:** `schema_v7.sql`, `routes/projectNotes.js` (nuevo), `services/functionExecutor.js`, `services/functions.js`, `js/projects.js`, `js/app.js`, `index.html`, `css/main.css`, `server.js`

### 7. Dashboard briefing rediseñado
- **Antes:** Hoy, Overdue, Active, Blocked, Tasks, Inbox (con sombreado accent hardcoded)
- **Ahora:** Today, This Week, Projects, Tasks (reminders+tasks combinados), Inbox, Watch Later
- Paleta de severidad por cantidad:
  - 1-5: sin sombreado (normal)
  - 5-15: fondo amarillo + borde warning
  - 15+: fondo rojo + borde danger
- Watch Later se carga via fetch directo a `/api/content`
- Alertas overdue y blocked siguen como banners
- **Archivos:** `js/hq.js`, `css/main.css`

### 8. Historial de completados en todas las pestañas (V8)
- Migracion: `processed_at` en inbox, `reviewed_at` en saved_content
- Backends actualizados: al marcar processed/reviewed se guarda timestamp automaticamente
- **Tasks:** toggle "Show completed" → historial de tasks+reminders completadas agrupadas por fecha
- **Projects:** toggle "Show completed projects" → proyectos done con fecha de completado
- **Inbox:** toggle "Show processed" → inbox procesado agrupado por fecha (se elimino la vista inline de procesados)
- **Watch Later:** "Show reviewed" ahora muestra historial agrupado por fecha de revision ademas de items inline
- Todas las vistas usan formato consistente: agrupado por fecha (Today, Yesterday, Mon 28 Mar...), items con tick verde, opacity reducida
- **Archivos:** `schema_v8.sql`, `routes/inbox.js`, `routes/content.js`, `js/tasksView.js`, `js/projects.js`, `js/inbox.js`, `js/library.js`, `index.html`, `css/main.css`

---

## MIGRACIONES BD

### V6 (schema_v6.sql)
```sql
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS due_time TIME;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT false;
```

### V7 (schema_v7.sql)
```sql
CREATE TABLE day_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_key DATE NOT NULL DEFAULT CURRENT_DATE,
    slot TEXT NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening', 'night')),
    domain TEXT NOT NULL CHECK (domain IN ('Trading', 'Dev', 'Bets', 'IA', 'Personal', 'Estudio')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    focus_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date_key, slot)
);
CREATE TABLE project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### V8 (schema_v8.sql)
```sql
ALTER TABLE inbox ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE saved_content ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
```

---

## ARCHIVOS NUEVOS
- `js/listsView.js` — Modulo frontend pestaña Lists
- `backend/services/reminderAlerts.js` — Cron alertas 30min antes por Telegram
- `backend/services/midnightCron.js` — Limpieza day_sessions a medianoche Madrid
- `backend/routes/daySessions.js` — CRUD day sessions
- `backend/routes/projectNotes.js` — CRUD project notes
- `backend/db/schema_v6.sql` — Migracion due_time + alert_sent
- `backend/db/schema_v7.sql` — Migracion day_sessions + project_notes
- `backend/db/schema_v8.sql` — Migracion processed_at + reviewed_at

## ARCHIVOS MODIFICADOS
- `index.html` — Lists tab, Day Plan card, history toggles en Projects/Tasks/Inbox/Watch Later
- `css/main.css` — Estilos Lists, Day Sessions, Project Notes, filtros scrollables, paleta severidad, historial completados
- `js/app.js` — Imports Lists, exports nuevos, TAB_ORDER con listsview
- `js/swipe.js` — Reescrito con deteccion de zonas scrollables
- `js/hq.js` — Day Sessions reemplaza FOR TODAY, briefing rediseñado (6 stats nuevos)
- `js/projects.js` — Project notes panel, historial completados
- `js/tasksView.js` — Historial completados toggle
- `js/inbox.js` — Historial procesados, eliminada vista inline de procesados
- `js/library.js` — Historial reviewed agrupado por fecha
- `backend/server.js` — Rutas daySessions, projectNotes + crons reminderAlerts, midnightCron
- `backend/routes/api.js` — due_time en POST/PUT reminders
- `backend/routes/inbox.js` — processed_at timestamp al procesar
- `backend/routes/content.js` — reviewed_at timestamp al revisar
- `backend/services/functionExecutor.js` — addReminder/editReminder con due_time, Day Sessions (build/set/get), Project Notes (add/get), getProjectDocs ampliado
- `backend/services/functions.js` — Schemas: due_time en add/edit_reminder, set_day_session, build_day_sessions, get_day_sessions, add_project_note, get_project_notes
- `backend/services/ai.js` — processAIForDayPlan (genera 4 sesiones via Claude)
- `backend/services/telegram.js` — ensureChatId en todos los commands
- `backend/services/morningBriefing.js` — Retry si no hay chatId, no duplica en restart, boton Build usa day_sessions
- `backend/.env` — TELEGRAM_CHAT_ID=1557251818

---

## KAIRA FUNCIONES (ahora 42)
Nuevas respecto a V5:
- `set_day_session` — Asignar dominio a una franja horaria
- `build_day_sessions` — Analizar office y proponer plan del dia
- `get_day_sessions` — Ver plan del dia actual
- `add_project_note` — Añadir nota/log a un proyecto
- `get_project_notes` — Ver historial de notas de un proyecto

## SERVICIOS AUTOMATIZADOS (ahora 7)
- Morning Briefing (08:00 CET via Telegram)
- Weekly Review (Domingos 20:00 CET)
- Monthly Review (Ultimo dia del mes 20:00 CET)
- Recurring Reminders (00:05 UTC daily)
- Reminder Alerts (cada 60s, Telegram 30min antes) **NUEVO**
- Midnight Cleanup (00:00 Madrid, limpia day_sessions) **NUEVO**
- Behavioral Intelligence (memoria persistente, actualizada semanalmente)

## TABS (ahora 9)
Dashboard > Projects > Tasks > **Lists** > Calendar > Inbox > Watch Later > Journal > Stats

---

## PENDIENTE
- Habit tracker
- Quick capture widget
- MT5 dashboard integration
- Polymarket tracker
- Push notifications (PWA)
- Git push al repo
