# Sesion 6 Mayo 2026

## Contexto
Vuelta despues de varios dias sin trabajar en la oficina y multiples resets del servidor. Estado inicial: backend en SQLite offline (desde 10-abr), errores en bucle en `reminderAlerts.js` por incompatibilidad del shim SQLite con `.or()`, briefing matinal de las 8 AM no llegando, journals nightly silenciosos. Sesion enfocada en estabilizar la oficina, volver a Supabase, arreglar la categorizacion de tareas completadas y permitir editar logs de proyecto.

## Diagnostico inicial

### Estado encontrado
- pm2 `kairos-backend`: online, uptime 4h, sobreviviendo a resets
- HTTPS `kairoslaboffice.trade/health`: 200 OK
- Crons activos: Morning Briefing, Recurring, Weekly/Monthly Review, Midnight, Nightly Journal
- DB: SEGUIA en SQLite offline (la migracion del 26-abr nunca se ejecuto)
- `reminderAlerts.js:50` petando cada 60 min con `TypeError: supabase.from(...).select(...).eq(...).eq(...).or is not a function`
- Briefing 8 AM no llegaba: solo se enviaban "startup briefings" cuando reiniciaba pm2 (a las 11, 12, 13...). Variable `briefingSentToday` en memoria, perdida en cada restart
- Journals nightly: 5 dias seguidos saliendo `No activity detected, skipping` — comportamiento correcto cuando no hay actividad

### Datos en SQLite acumulados desde 10-abr (26 dias offline)
| Tabla | Total | Desde 10-abr |
|-------|-------|--------------|
| completed | 31 | 12 |
| project_notes | 34 | 10 |
| journal | 19 | 8 |
| saved_content | 35 | 7 |
| tasks | 12 | 6 |
| reminders | 3 | 2 |

## Acciones tomadas

### 1. Fix briefing matinal (independiente de Supabase)

**Problema:** `setTimeout` + `setInterval` volatiles, `briefingSentToday` en memoria perdida en restart, podia causar spam de briefings al reiniciar pm2 entre las 8-22 horas.

**Cambios en `backend/services/morningBriefing.js`:**
- Migrado a `node-cron` con `'0 8 * * *'` zona `Europe/Madrid` — sobrevive resets
- Persistencia de fecha de ultimo envio en `kaira_memory.briefing_last_sent` (key='briefing_last_sent', category='system')
- Catch-up briefing al arrancar entre 8-22h SOLO si la fecha persistida != hoy
- Idempotencia: doble check antes de enviar, no duplica jamas

**Verificado con 2 restarts seguidos:** segundo restart loggea `Already sent today (2026-05-06), skipping startup briefing`. No spam.

**Cambio adicional en `backend/db/sqlite-schema.js`:**
- `idx_memory_key` cambiado a `UNIQUE INDEX` (requerido por `ON CONFLICT(key)` del upsert)
- Aplicado tambien en vivo a la DB SQLite existente

**Dependencia nueva:** `node-cron` en `backend/package.json`.

### 2. Reactivacion Supabase

**Diagnostico:** `qjuoncrjwqhtvrjdlemg.supabase.co` no resolvia en DNS publico (Google 8.8.8.8 devolvia "Non-existent domain"). Causa: free tier de Supabase pausa los proyectos tras ~7 dias sin queries. Llevamos 26 dias offline.

**Accion del usuario:** Restore manual desde dashboard Supabase. Tras Restore, DNS resolvio (`/rest/v1/` devolvio 401, esperado sin auth).

### 3. Migracion SQLite -> Supabase

**Sync ejecutado:** `node backend/db/sync-to-supabase.js`
- 150 filas sincronizadas en primera pasada
- WARN en `completed`: SQLite tiene columna `category` que no existia en Supabase. El script generico la rechazaba.
- 31 filas extra de `completed` migradas con script ad-hoc strippeando `category` (las 31 tenian `category = NULL` igualmente)
- **Total: 181 filas reincorporadas a Supabase**

| Tabla | Filas migradas |
|-------|----------------|
| projects | 10 |
| journal | 19 |
| reminders | 3 |
| tasks | 12 |
| completed | 31 |
| inbox | 7 |
| daily_plan | 6 |
| kaira_memory | 1 |
| lists | 2 |
| list_items | 21 |
| saved_content | 35 |
| project_notes | 34 |

**Cliente DB revertido:** `git checkout backend/db/supabase.js` -> vuelve al cliente real de `supabase-js`. pm2 restart.

**Bug `.or() is not a function` resuelto automaticamente** — el cliente real soporta `.or()` correctamente. Verificado con query test directa.

### 4. Categorizacion de tareas completadas

**Bug encontrado (pre-existente):** `services/functionExecutor.js completeItem` (lineas 127-153) nunca leia `category` ni `project_id` de la task/reminder origen al moverla a `completed`. Por eso TODAS las completadas historicas quedaban con esos campos a null aunque la task original estuviera categorizada y asociada a proyecto. Bug que ha estado activo desde el dia 1.

**ALTER TABLE ejecutado en Supabase dashboard:**
```sql
ALTER TABLE completed ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE completed ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
```

**Fix aplicado en 4 puntos del codigo:**
1. `services/functionExecutor.js completeItem` — ahora lee `category, project_id` de la task/reminder y los copia al insert en completed
2. `routes/api.js POST /completed` — acepta `category` y `project_id` del body (para completes manuales desde frontend)
3. `routes/api.js GET /completed` — devuelve `category, project_id, projects(name, domain)` via join con tabla projects
4. `routes/stats.js` — añade `completedByCategory` y `completedByProject` al endpoint /api/stats

**Backfill 31 filas historicas:** Javi confirmo categorias y proyectos manualmente. Resultado: 31/31 con category, 18/31 con project_id (las restantes son Personal, Dev de la oficina, y HobbieCode que se dejaron sin proyecto).

Distribucion final:
- 14 Trading (Porfolio A_TTP, Porfolio B_TTP, Indicadores_customizados)
- 8 Personal (limpiar casa, Mercadona, cordones, corbata, Fernando Vaquero, Chinini)
- 6 IA (todas en Lucy_Rivero — pipelines de generacion, story line)
- 4 Dev (oficina sin proyecto)
- 1 Bets (Poly_Whisper — bloomberg/X noticias)

**Notas de la categorizacion:**
- Las repeticiones de "Crear pipeline maximo realismo" (3 veces) no son bug del sistema, sino el usuario añadiendo la misma task multiples veces antes de completar
- Las 31 filas historicas pre-fix tenian `category = NULL` siempre. La info original se perdio cuando se ejecuto el delete de la task. No recuperable de otra forma que la categorizacion manual hecha hoy

### 5. Editar logs de proyecto (project_notes)

**Problema:** Los project_notes solo se podian añadir y borrar, no editar. Backend no tenia PUT, frontend no tenia boton edit.

**Cambios:**
- `backend/routes/projectNotes.js` — añadido `PUT /api/project-notes/:id` (valida content no vacio, devuelve fila actualizada). Test 200 OK.
- `js/projects.js` — `loadProjectNotes` ahora añade boton ✎ + click sobre el texto para editar inline. Funciones nuevas `editProjectNote` y `saveProjectNoteEdit` (Enter guarda, Escape cancela).
- `js/app.js` — registradas en `window.*`.

### 6. Tasks de proyecto en calendario y radar

**Problema reportado:** "Tareas dentro del proyecto con fecha no aparecen en calendario o en radar".

**Diagnostico:** No era lo que parecia. Los datos YA estaban en Supabase y `/api/tasks` los devolvia correctamente (4 pendientes con deadline: 2 sueltas, 2 de proyecto). El codigo de calendario (`calendar.js:106`) y radar (`hq.js:235`) YA filtraban por `t.deadline` correctamente.

**Causa real:** Cuando el usuario añade/edita/borra/completa una task desde el panel del proyecto, el cache global de `Storage` no se refrescaba. La task nueva no aparecia en radar/calendar/tasks-view hasta hard reload del navegador.

**Fix:**
- `js/projects.js` — `addProjectTask`, `saveProjectTaskEdit`, `deleteProjectTask`, `toggleProjectTask` ahora hacen `await Storage.refresh()` + emiten `CustomEvent('kairos:tasks-changed')` via helper `rerenderTaskViews()`
- `js/app.js` — listener global `window.addEventListener('kairos:tasks-changed', ...)` que llama `renderHQ()`, `renderCalendar()`, `renderTasksView()` automaticamente

**Resultado:** las tasks de proyecto aparecen al instante en radar/calendar/tasks-view sin recargar.

### 7. Saldo Anthropic API (no resoluble)

**Pregunta del usuario:** consultar saldo disponible de Kaira en la API.

**Diagnostico:** API key actual es `sk-ant-api03-...` (regular, nivel desarrollador). Anthropic NO expone saldo de cuenta via API regular — solo el Admin API (`sk-ant-admin-...`) puede consultar usage reports, y requiere configurar la cuenta como organizacion.

**Solucion ofrecida:**
- Consulta manual: https://console.anthropic.com/settings/billing y https://console.anthropic.com/settings/usage
- Alternativa propuesta (no implementada): contador de tokens propio dentro de la oficina, agregando input/output por cada llamada Claude (Kaira chat, briefing, weekly review, nightly journal). Persistir en kaira_memory. Calcular coste en € en /api/stats. Daria consumo de Kaira mes a mes (no saldo real de Anthropic). ~30 min de trabajo, pendiente de decision del usuario.

## Cambios resumen

### Backend
- `backend/services/morningBriefing.js` — node-cron + persistencia idempotente
- `backend/db/supabase.js` — revertido a cliente real (`git checkout`)
- `backend/db/sqlite-schema.js` — `idx_memory_key` UNIQUE
- `backend/services/functionExecutor.js completeItem` — copia category + project_id
- `backend/routes/api.js POST/GET /completed` — soporte category + project_id + join projects
- `backend/routes/stats.js` — `completedByCategory`, `completedByProject`
- `backend/routes/projectNotes.js` — nuevo `PUT /:id`

### Frontend
- `js/projects.js` — editar project_notes inline, refresh global tras cambios en project tasks
- `js/app.js` — listener `kairos:tasks-changed` re-renderiza HQ/Calendar/TasksView

### DB Supabase
- `ALTER TABLE completed` — columnas `category TEXT` y `project_id UUID` añadidas
- 181 filas migradas desde SQLite (de los 26 dias offline)
- 31 completed historicas categorizadas y asociadas a proyecto donde aplica

### Dependencias
- `node-cron` añadido en `backend/package.json`

## Estado final

- Backend en cliente Supabase real, pm2 online estable
- Briefing 8 AM Madrid garantizado via cron, sin spam, sin misses
- `.or() is not a function` resuelto
- Categorizacion de completed funcionando para futuros completes
- Project_notes editables
- Tasks de proyecto aparecen al instante en radar/calendar
- Health check completo: ALL OK ✓

## Pendiente (carry-over)

- Decidir contador de tokens Anthropic propio (alternativa al saldo no consultable via API)
- `startup_kairos.bat`: PATH de pm2 falla en resets del servidor (sigue pendiente desde sesiones previas)
- Habit tracker, Quick capture widget, MT5 dashboard, Polymarket tracker, push notifications
- Ningun proyecto tiene `deadline` puesto aun (la columna existe y funciona — falta rellenarlos)
