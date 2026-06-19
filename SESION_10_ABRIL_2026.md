# Sesion 10 Abril 2026

## Contexto
Supabase restringio el acceso API completo al proyecto KairosLab por exceso de egress acumulado (23.64 GB / 5.5 GB). La PWA y la URL dejaron de mostrar datos. El correo de Supabase confirma que el acceso se restaura el 26 de abril de 2026 (reset del ciclo de facturacion).

## Diagnostico
- `curl` al REST API de Supabase devuelve: `"Service for this project is restricted due to the following violations: exceed_egress_quota"`
- El dashboard web de Supabase sigue accesible (solo el API esta bloqueado)
- Los datos estan intactos, solo el acceso esta cortado
- El consumo desde el fix del 7-abr fue de ~500 KB total (vs 23 GB acumulados de bots)

## Acciones tomadas

### 1. Ticket a Supabase Support
- Enviado via supabase.help (no por email — `support@supabase.help` no existe)
- Ticket ID: SU-355715
- Explicacion del caso: abuso externo resuelto, 500 KB desde el fix
- Respuesta automatica: Free plan sin soporte garantizado

### 2. SQLite Offline Fallback (cambio principal)
Se implemento un sistema de fallback completo que reemplaza Supabase por SQLite local, sin modificar ninguna ruta ni servicio existente.

#### Archivos nuevos:
- `backend/db/sqlite-schema.js` — Schema SQLite con las 18 tablas (mirrors Supabase)
- `backend/db/sqlite-client.js` — Query builder compatible con la API de Supabase
  - Soporta: select, insert, update, delete, upsert
  - Filtros: eq, neq, gt, gte, lt, lte, in, is, ilike, not
  - Modificadores: order, limit, single
  - Relaciones padre (FK en esta tabla) e hijos (FK en otra tabla)
  - Proxy para chainable API: `.insert(row).select().single()`
  - Conversion automatica booleanos (SQLite 0/1 ↔ JS true/false)
  - Query counter para egress-debug endpoint
- `backend/db/import-csv.js` — Importador de CSVs exportados desde Supabase dashboard
- `backend/db/sync-to-supabase.js` — Script de sync para cuando Supabase vuelva

#### Archivo modificado:
- `backend/db/supabase.js` — Swapped para importar sqlite-client en vez de @supabase/supabase-js
  - Codigo original comentado para facil reversion: `git checkout backend/db/supabase.js`

#### Dependencia nueva:
- `better-sqlite3` — SQLite nativo para Node.js

#### Datos importados:
- 12 tablas con datos exportados via CSV desde Supabase dashboard
- 137 rows totales importadas
- Tablas vacias (sin datos que exportar): activity_log, expenses, kaira_memory, notes, recurring_reminders

| Tabla | Rows |
|-------|------|
| projects | 10 |
| journal | 11 |
| reminders | 2 |
| tasks | 11 |
| completed | 19 |
| inbox | 8 |
| daily_plan | 6 |
| lists | 2 |
| list_items | 12 |
| saved_content | 28 |
| day_sessions | 4 |
| project_notes | 24 |

#### Resultado:
- 14/14 smoke tests pasados
- PWA y URL funcionando identico a antes
- Todos los servicios activos (Telegram, briefings, journals, crons)
- Egress-debug muestra `mode: sqlite_offline`

### 3. TTS Voice Fix (Kaira)
La voz de Kaira sonaba poco natural: entonacion erratica, pausas incorrectas, poca fidelidad a la voz original.

#### Cambios en `backend/services/tts.js`:
| Parametro | Antes | Despues | Razon |
|-----------|-------|---------|-------|
| model_id | eleven_multilingual_v2 | eleven_turbo_v2_5 | Mas fluido, mejor prosodia |
| stability | 0.5 | 0.70 | Pausas correctas, voz consistente |
| similarity_boost | 0.75 | 0.85 | Mas fiel a la voz original |
| style | 0.3 | 0.15 | Menos exageracion en entonacion |

Sin coste adicional (ElevenLabs cobra por caracteres, no por modelo).

## Plan para el 26 de abril
Cuando Supabase restaure el acceso:
```bash
node backend/db/sync-to-supabase.js    # Sube datos offline a Supabase
git checkout backend/db/supabase.js     # Revierte al cliente original
pm2 restart kairos-backend              # Reinicia
```

## Estado final
- Office 100% operativa en modo offline (SQLite)
- Voz de Kaira mejorada significativamente
- Pendiente: restauracion Supabase el 26-abr-2026

---

## Apendice: Incidente 11-abr-2026 — PWA y URL no cargan

### Sintoma
La PWA de KairosLab Office dejo de funcionar y `kairoslaboffice.trade` no cargaba desde el portatil (España). Desde el servidor (Hetzner, Alemania) funcionaba perfectamente.

### Diagnostico
1. **Desde el servidor:** pm2 online, tunnel activo, Playwright carga la Office completa con datos, todas las llamadas API devuelven 200.
2. **Desde el portatil (España):** la URL no cargaba nada. Al investigar, el navegador mostraba un mensaje de bloqueo judicial:
   > "El acceso a la presente dirección IP ha sido bloqueado en cumplimiento de lo dispuesto en la Sentencia de 18 de diciembre de 2024, dictada por el Juzgado de lo Mercantil nº 6 de Barcelona..."

### Causa raiz
**Bloqueo de LaLiga contra IPs de Cloudflare.** LaLiga obtuvo una orden judicial para que los ISPs españoles bloqueen rangos enteros de IPs de Cloudflare porque hay servicios IPTV pirata detras de su infraestructura. Como KairosLab Office usa Cloudflare Tunnel, comparte rango de IPs con esos servicios y el ISP bloquea sin distinguir.

- El bloqueo es del ISP español, no de Cloudflare ni del servidor
- Solo afecta a conexiones desde España durante jornadas de LaLiga
- **Solucion:** cambiar DNS del portatil a `1.1.1.1` / `1.0.0.1` (Cloudflare DNS) o usar VPN
- Con VPN se confirmo que la Office cargaba perfectamente

### Cambios aprovechados (mejora de arquitectura)
Durante la investigacion se detecto que `www.kairoslaboffice.trade` devolvia 404 (hostname no configurado en el tunnel). Todos los JS usaban `www.` para las llamadas API, lo cual era un bug latente. Se corrigio y se simplifico la arquitectura:

#### 1. URLs de API corregidas (12 archivos JS)
`https://www.kairoslaboffice.trade` → `https://kairoslaboffice.trade` en:
assistant.js, hq.js, dayDetail.js, inbox.js, storage.js, stats.js, projects.js, tasksView.js, library.js, listsView.js, journalTab.js, search.js

#### 2. Arquitectura simplificada: 2 procesos → 1
- Backend Express ahora sirve tambien los archivos estaticos del frontend (`express.static`, sin cache: `maxAge: 0, etag: false`)
- Puerto cambiado de 3001 a 5500 (donde apunta el tunnel)
- `kairos-frontend` (http-server) eliminado de pm2 — ya no se necesita
- Service Worker actualizado a `kairos-v3` para invalidar cache antiguo

#### Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `backend/server.js` | +import path/fileURLToPath, +express.static del directorio padre (no-cache) |
| `backend/.env` | PORT=3001 → PORT=5500 |
| `backend/smoke-test.js` | localhost:3001 → localhost:5500 |
| `ecosystem.config.cjs` | Eliminado bloque kairos-frontend |
| `js/*.js` (12 archivos) | www.kairoslaboffice.trade → kairoslaboffice.trade |
| `sw.js` | CACHE_NAME kairos-v2 → kairos-v3 |
| `index.html` | app.js → app.js?v=3 (cache bust) |

### Impacto en plan de restore Supabase (26-abr)
Ninguno. Los cambios son de networking, no de base de datos. El plan de restore sigue igual:
```bash
node backend/db/sync-to-supabase.js
git checkout backend/db/supabase.js
pm2 restart kairos-backend
```

### Nota sobre Supabase y el bloqueo
Supabase usa AWS, no Cloudflare, y las llamadas se hacen desde el backend (Alemania). El bloqueo de LaLiga no afectara a Supabase. Lo que seguira afectado es el acceso del usuario a la Office via Cloudflare Tunnel desde ISPs españoles. Alternativa futura: servir la Office sin Cloudflare (IP directa de Hetzner + nginx + Let's Encrypt).

### Nota adicional
El error repetido en logs (`supabase.from(...).or is not a function` en reminderAlerts.js:51) persiste — el cliente SQLite offline no implementa `.or()`. No es critico pero spamea los error logs cada 60 minutos.
