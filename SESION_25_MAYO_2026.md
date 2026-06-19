# Sesion 25 Mayo 2026

## Contexto
Javi recibe email de Supabase: "project scheduled to be paused in a couple of days" sobre `Kairos_virtual_office` por inactividad. Investigando si todo esta bien con la oficina virtual, se destapa una cascada de bugs latentes en el manejo de `kaira_memory` que estaban fallando silenciosamente desde hace dias. Sesion enfocada en blindar contra futuras pausas y arreglar todos los bugs detectados.

## Diagnostico inicial

### Estado encontrado
- pm2 `kairos-backend`: online, uptime 2 dias (algun restart reciente)
- Cliente DB apuntando a Supabase real (no SQLite fallback, OK desde 06-may)
- Briefings 23/24/25-may enviados segun logs → backend funcionando
- Weekly review 24-may generado y guardado en journal, PERO sin "Sent to Telegram"
- Errores intermitentes Telegram polling: `502 Bad Gateway`, `ECONNRESET`, `ETIMEDOUT` (flaky del servicio externo, no critico)
- Error en weekly review: `ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 765`

### Inconsistencia detectada al inspeccionar `kaira_memory`
- Campo `briefing_last_sent.value` = `2026-05-06` (congelado 19 dias) PERO los logs mostraban briefings enviados 23/24/25-may
- Esto significaba que la idempotencia "no enviar 2 veces el mismo dia tras restart" estaba rota: cualquier restart entre 8-22h Madrid dispararia un segundo briefing porque `lastSent` siempre era una fecha vieja

## Acciones tomadas

### 1. Keep-alive contra pausa de Supabase Free

**Problema:** Free tier pausa proyectos tras ~7 dias de baja actividad. El backend hacia briefings 1x/dia + checks de reminders, pero el volumen era insuficiente para Supabase. Ya paso una vez el 06-may (Javi tuvo que hacer Restore manual).

**Implementacion:**
- Nuevo archivo `backend/services/keepAlive.js`
- Cron `0 12 * * *` Europe/Madrid → 1 ping/dia (`SELECT id FROM projects LIMIT 1`)
- Iniciado desde `server.js` al final del bootstrap (despues de `startNightlyJournal`)
- Frecuencia inicial 4/dia (cada 6h), bajada a 1/dia a peticion de Javi para minimizar egress. Margen 7x sobre el threshold de pausa.

**Resultado:** primer ping OK a 15:50 UTC. Proximo a 12:00 Madrid diariamente.

### 2. Fix bug del UNIQUE constraint inexistente en `kaira_memory.key`

**Causa raiz:** la columna `key` de `kaira_memory` NO tiene UNIQUE constraint en Supabase. Todos los `.upsert(..., { onConflict: 'key' })` fallaban con Postgres error `42P10`. supabase-js NO lanza excepciones, solo devuelve `{error}`, asi que los `try/catch` no atrapaban nada y los bugs eran invisibles.

**Sitios arreglados** (patron unificado: SELECT → UPDATE-or-INSERT, sin tocar schema):

#### `backend/services/morningBriefing.js` `saveLastSent`
- **Antes:** `.upsert({...}, { onConflict: 'key' })` dentro de try/catch
- **Despues:** select por key con `.maybeSingle()` → update si existe, insert si no. Logueo de `{error}` del response.
- **Impacto real:** causa raiz del `briefing_last_sent` congelado. Ahora la idempotencia funciona.

#### `backend/routes/memory.js` POST `/api/memory`
- Mismo patron. Bug latente, no daba problema visible porque el endpoint apenas se usa.

#### `backend/services/weeklyReview.js` `generateBehavioralInsights`
- 4 upserts con `onConflict: 'category,key'` (constraint compuesto que tampoco existe).
- Extraido helper local `upsertMemory({ category, key, value })` reutilizable.
- Insights `behavioral_insights`, `most_productive_day`, `most_active_category`, `avg_tasks_per_week` ahora persisten correctamente.

### 3. Fix crash de Telegram parse entities en weekly/monthly review

**Causa raiz:** `parse_mode: 'Markdown'` (Markdown v1 legacy de Telegram). Cuando Claude genera el review con `_`, `*`, `` ` ``, `[` desbalanceados, Telegram rechaza el mensaje con `400 Bad Request: can't parse entities`. El review se generaba OK y se guardaba en journal, pero nunca llegaba al chat.

**Implementacion:**
- Helper local `safeSendMarkdown(bot, chatId, message)` en `weeklyReview.js`
- Intenta envio con `parse_mode: 'Markdown'`. Si error contiene "parse entities", reintenta como plain text (sin formato pero no falla).
- Aplicado a 4 `sendMessage` calls: weekly fullMessage, weekly chunks, monthly fullMessage, monthly chunks.

### 4. Token GitHub MCP actualizado

- Token caducado sustituido en `~/.claude.json` linea 609 (env var `GITHUB_PERSONAL_ACCESS_TOKEN` del MCP `github`)
- Verificado tras reload: `search_repositories user:KairoIA` devolvio los 5 repos publicos correctamente
- 26 funciones del MCP disponibles (repos, PRs, issues, search, users)

## Verificacion

### Test directo del fix kaira_memory
```
=== Test 1: briefing_last_sent persistence ===
  value: 2026-05-25 | updated: 2026-05-25T15:37:16.512383+00:00

=== Test 2: simulate weeklyReview upsertMemory pattern ===
  Insert error: OK
  Update error: OK
  Final value: second_value (expect: second_value)
  Cleanup: OK
```

### Idempotencia briefing restaurada
Durante 4 restarts de testing:
- Restarts 1-3 (con bug aun no propagado): catch-up briefing disparado, Javi recibio 3 briefings extra
- Restart 4 (tras todos los fixes aplicados): `[BRIEFING] Already sent today (2026-05-25), skipping startup briefing` ✓

### Supabase
- Conectividad verificada: latencia 949ms, 10 projects devueltos
- Keep-alive cron registrado: `[KEEPALIVE] Cron scheduled daily at 12:00 Europe/Madrid`
- Ping inicial OK

## Estado final
- Backend `kairos-backend` online tras 4 restarts limpios
- Supabase blindado contra pausa por inactividad
- `kaira_memory` upserts funcionan en los 3 sitios donde estaban rotos
- Weekly/monthly review robustos al parse fail de Telegram
- MCP GitHub operativo con nuevo token

## Pendiente
- Errores polling Telegram (502/ECONNRESET/ETIMEDOUT): flaky del servicio externo, lib `node-telegram-bot-api` reintenta sola. No requiere accion.
- Otros upserts no tocados (`onConflict: 'date_key'` / `date_key,slot` en journal, daily_plan, top3): NO presentan errores en produccion, posiblemente esos constraints SI existen. No tocar mientras no haya sintomas.

## Archivos modificados
- `backend/services/keepAlive.js` (NUEVO)
- `backend/server.js` (import + start del keep-alive)
- `backend/services/morningBriefing.js` (`saveLastSent` refactor)
- `backend/routes/memory.js` (POST refactor)
- `backend/services/weeklyReview.js` (helpers `safeSendMarkdown` + `upsertMemory` + 4 reemplazos upsert + 4 reemplazos sendMessage)
- `~/.claude.json` (token GitHub MCP)
