# Sesion 6 Abril 2026

## Contexto
Supabase envio un aviso: la organizacion KairosLab habia consumido **23.6 GB de egress** sobre un limite de 5 GB (473%) en el plan Free. Periodo de gracia hasta el 5 de mayo de 2026.

## Diagnostico

### Causa principal: API publica sin autenticacion
- `NODE_ENV=development` en `.env` Y en `ecosystem.config.cjs` → el middleware de auth hacia `return next()` para TODAS las requests
- La API estaba completamente abierta en `kairoslaboffice.trade/api/*`
- Bots/crawlers de internet escaneaban los endpoints continuamente, generando queries a Supabase sin control
- **Confirmado**: tras activar auth, el contador `/health` registro 17 requests bloqueadas en los primeros minutos

### Causa secundaria: queries ineficientes
- `reminderAlerts.js`: `select('*')` de TODOS los reminders cada 60 segundos, 24/7 = 1,440 queries/dia
- 87 instancias de `select('*')` en todo el backend trayendo datos innecesarios
- `nightlyJournal.js` y `weeklyReview.js` con queries duplicadas

## Cambios realizados

### 1. Seguridad — API Auth (fix critico)
- `.env`: `NODE_ENV=production`, nuevo `API_SECRET` generado (64 chars hex)
- `ecosystem.config.cjs`: `NODE_ENV=production` (antes overrideaba el .env con `development`)
- `index.html`: override global de `fetch()` que inyecta `x-api-key` header en todas las llamadas a `/api/`
- `middleware/auth.js`: contador de requests autorizadas/bloqueadas
- `server.js`: `/health` endpoint muestra stats de auth (`authorized`, `blocked`, `since`)
- `smoke-test.js`: actualizado para enviar API key desde `API_SECRET` en `.env`
- `deploy.sh`: exporta `API_SECRET` del `.env` antes de ejecutar smoke test

### 2. Optimizacion de egress — Queries Supabase

#### reminderAlerts.js (mayor impacto)
- Intervalo: 60s → **300s (5 min)** — reduce queries 80%
- `select('*')` → `select('id, text, due_date, due_time')` — 4 campos en vez de ~15
- Filtro server-side: `.or('due_date.eq.${today},due_date.is.null')` — no trae reminders de otros dias

#### morningBriefing.js
- 8 queries optimizadas con columnas especificas
- `saved_content`: solo `topic` para contar, no `title`
- `notes`: filtro `pinned=true` server-side
- Callback "full_details": 4 queries optimizadas

#### nightlyJournal.js
- 12 queries → **10 queries** (eliminada query duplicada de `project_notes`)
- Todas con columnas especificas
- Tasks/reminders filtran `done=false` en la query

#### weeklyReview.js
- `gatherWeekData`: 7 queries con columnas minimas
- `gatherBehavioralData`: 3 queries optimizadas
- `gatherMonthData`: 8 → **7 queries** (eliminada query duplicada `tasksAllRes`)
- `generateBehavioralInsights`: solo `type, completed_date`

#### functionExecutor.js (37 select('*') optimizados)
- `getAgenda`, `getBriefing`, `buildDailyPlan`, `buildDaySessions`: columnas especificas
- `getProjectDocs`: 5 sub-queries optimizadas
- `completeItem`, `editTask`, `editReminder`, `updateProject`: solo `id, text`
- `getExpenses`, `getActivitySummary`, `getSavedContent`, `getCompleted`: columnas especificas
- `recallMemory`, `listRecurring`, `getNotes`, `manageList`, `getProjectNotes`: idem

#### Otros archivos
- `recurringCron.js`: columnas especificas
- `telegram.js`: `/pending` solo `title, topic, url`

### 3. Feature — Frase celebre del dia
- `data/quotes.json`: 365 frases unicas, 182 autores distintos
- Mix: filosofos, cientificos, deportistas, politicos, escritores, militares, proverbios populares
- Cada frase incluye campo `d` con descripcion del autor (quien fue, epoca, logros)
- Se selecciona por dia del año (`dayOfYear % 365`), cambia a medianoche
- Renderizado en `hq.js` > `renderDate()` con cache del JSON
- Sin queries a Supabase — archivo estatico servido por el frontend
- CSS: `.daily-quote`, `.daily-quote-text`, `.daily-quote-author`, `.daily-quote-desc`

### 4. Fix — Calendario PWA mobile
- Celdas compactas: `min-height: 52px`, `padding: 4px`, `gap: 3px`
- Leyenda de items oculta en movil (solo badges R/T/check visibles)
- Nombres de dia y numeros mas pequeños
- `overflow-x: hidden` en `.view` y `.calendar-wrapper`
- Controles del calendario mas compactos

### 5. Fix — Briefing header mobile
- Titulo y fecha apilados verticalmente (`flex-direction: column`)
- Titulo DAILY BRIEFING mas pequeño (0.8rem)
- Frase celebre con separacion adecuada, autor en su propia linea

## Commits
```
bac4b0b fix: mobile briefing header
107f6b8 fix: calendar PWA mobile
dbab642 feat: add author descriptions to daily quotes
9ce38d3 feat: daily motivational quote on Dashboard
bdc1ba0 feat: auth request counter on /health
7c1a1ea fix: ecosystem.config NODE_ENV=production
7154b83 fix: auth + optimize Supabase egress
```

## Seguimiento
- **Verificar egress**: revisar dashboard Supabase en 3-5 dias para confirmar que el consumo bajo drasticamente
- **Monitorear bots**: `curl http://localhost:3001/health` para ver contador de `blocked`
- **Deadline Supabase**: 5 mayo 2026 — si sigue excediendo, considerar upgrade a Pro ($25/mes)

## Modelo deprecated
Los logs muestran que `claude-3-5-haiku-20241022` esta deprecated. Hay que actualizar a `claude-haiku-4-5-20251001` en `weeklyReview.js` (la referencia en `nightlyJournal.js` y `ai.js` ya usa el modelo correcto).
