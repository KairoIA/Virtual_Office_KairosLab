# KAIROS LAB — Virtual Office
## Sesion 27 Marzo 2026

---

## RESUMEN

Primera sesion de construccion. Se paso de un HTML monolitico a una oficina virtual completa con IA, desplegada en produccion. Posteriores iteraciones (entre sesiones) expandieron masivamente las capacidades.

---

## ESTADO ACTUAL DEL PROYECTO

### Arquitectura

```
kairoslaboffice.trade (frontend)       www.kairoslaboffice.trade (backend)
        |                                         |
   Cloudflare Tunnel                       Cloudflare Tunnel
        |                                         |
   http://localhost:5500                   http://localhost:3001
   (http-server)                           (Node.js + Express)
        |                                         |
   HTML/CSS/JS (ES Modules)                Supabase (PostgreSQL)
   PWA installable                         Claude Haiku 4.5 (LLM)
                                           Whisper (STT)
                                           ElevenLabs (TTS)
                                           Telegram Bot
```

### Estructura de archivos completa

```
Virtual_Model_KairosLab/
├── index.html                        <- Frontend: nav tabs, HQ, projects, calendar, inbox, library
├── manifest.json                     <- PWA manifest
├── sw.js                             <- Service Worker
├── assets/
│   ├── logo_app.png
│   ├── logo_web.png
│   └── kaira_avatar.png
├── css/
│   ├── main.css                      <- Estilos oficina (nav, HQ, projects, calendar, etc)
│   └── assistant.css                 <- Estilos chat Kaira (con avatar)
├── js/
│   ├── app.js                        <- Orquestador + navegacion entre views
│   ├── storage.js                    <- Capa datos V2 (API + cache + projects/inbox/top3)
│   ├── calendar.js                   <- Calendario mensual
│   ├── journal.js                    <- Editor rich-text diario
│   ├── tasks.js                      <- Reminders + Tasks + History
│   ├── search.js                     <- Busqueda global
│   ├── canvas.js                     <- Fondo animado velas
│   ├── assistant.js                  <- Chat + Voz Kaira (REST, streaming, typewriter sync)
│   ├── hq.js                         <- HQ dashboard (briefing, top3, radar, project load)
│   ├── projects.js                   <- Gestion de proyectos (CRUD, filtros, modal)
│   ├── inbox.js                      <- Captura rapida al inbox
│   └── library.js                    <- Watch Later (contenido guardado, filtros por tema)
├── backend/
│   ├── server.js                     <- Express server (all routes + telegram bot)
│   ├── package.json                  <- Dependencies (anthropic, supabase, telegram, openai, etc)
│   ├── .env                          <- Credenciales (gitignored)
│   ├── .env.example
│   ├── start-kairos.bat              <- Script arranque Windows
│   ├── db/
│   │   ├── schema.sql                <- Schema V1
│   │   ├── schema_v2.sql             <- Schema V2 (projects, inbox, top3)
│   │   ├── schema_v2_expenses.sql    <- Schema expenses
│   │   ├── schema_v3.sql             <- Schema V3 (memory, lists, activity, content, recurring)
│   │   └── supabase.js               <- Cliente Supabase
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── api.js                    <- CRUD: journal, reminders, tasks, completed, import
│   │   ├── voice.js                  <- Voz: transcribe, chat, chat-stream, tts
│   │   ├── projects.js               <- CRUD proyectos
│   │   ├── inbox.js                  <- CRUD inbox
│   │   ├── top3.js                   <- Prioridades diarias
│   │   ├── expenses.js               <- Registro gastos
│   │   ├── memory.js                 <- Memoria persistente Kaira
│   │   ├── lists.js                  <- Listas custom
│   │   ├── activity.js               <- Diario de actividad
│   │   └── content.js                <- Contenido guardado (Watch Later)
│   └── services/
│       ├── ai.js                     <- Claude Haiku 4.5 + streaming + tool use + memory injection
│       ├── functions.js              <- ~25 funciones (V1+V2+V3)
│       ├── functionExecutor.js       <- Ejecutor contra Supabase
│       ├── stt.js                    <- Whisper STT
│       ├── tts.js                    <- ElevenLabs TTS streaming
│       ├── telegram.js               <- Bot Telegram (recibe links → Watch Later)
│       ├── websearch.js              <- Busqueda web
│       └── voicePipeline.js          <- WebSocket (legacy, no usado)
└── .gitignore
```

---

## SERVICIOS Y CREDENCIALES

| Servicio | Plan | Coste | Notas |
|----------|------|-------|-------|
| Supabase | Free | $0 | DB PostgreSQL cloud |
| Anthropic (Claude Haiku 4.5) | Pay-as-you-go | ~$3-5/mes | Reemplazo de GPT-4o-mini |
| OpenAI (Whisper) | Pay-as-you-go | ~$1-3/mes | Solo STT |
| ElevenLabs | Creator primer mes, luego Starter | $5-11/mes | TTS voz paisa |
| Cloudflare | Free + dominio | $4.16/year | Tunnel HTTPS |
| Hetzner VPS | Windows Server 2019 | ~5 EUR/mes | IP: 65.21.31.201 |
| GitHub | Free (public) | $0 | KairoIA/Virtual_Office_KairosLab |
| Telegram Bot | Free | $0 | Recibe links para Watch Later |

Todas las keys en `backend/.env` (gitignored).

---

## FUNCIONES DE KAIRA (25 tools)

### V1 — Core
| Funcion | Que hace |
|---------|----------|
| add_reminder | Crear reminder con fecha |
| add_task | Crear tarea backlog |
| complete_item | Completar reminder/tarea |
| delete_item | Eliminar item |
| write_journal | Escribir/añadir al journal |
| get_agenda | Ver agenda (deadlines, overdue, this/next week, projects) |
| search_entries | Buscar en todo |

### V2 — Office Management
| Funcion | Que hace |
|---------|----------|
| create_project | Crear proyecto (Trading/Dev/IA/Bets/Personal) |
| update_project | Actualizar status/objetivo/accion |
| add_to_inbox | Captura rapida al inbox |
| set_top3 | Prioridades diarias (slot 1-3, energia) |
| get_briefing | Briefing completo del dia |
| log_expense | Registrar gasto |
| get_expenses | Resumen gastos por periodo/categoria |

### V3 — Intelligence
| Funcion | Que hace |
|---------|----------|
| save_memory | Memoria persistente (preferencias, personas, salud, etc) |
| recall_memory | Buscar en memoria |
| manage_list | Listas custom (compra, maleta, ideas...) |
| log_activity | Diario actividad (gym, reunion, trading...) |
| get_activity_summary | Resumen actividad por periodo |
| save_content | Guardar link/video/post para despues |
| get_saved_content | Ver contenido pendiente |
| mark_content_reviewed | Marcar como visto |
| create_recurring | Recordatorio recurrente |
| list_recurring | Ver recurrentes activos |
| web_search | Busqueda web |

---

## VISTAS DEL FRONTEND

| Vista | Tab | Que muestra |
|-------|-----|-------------|
| HQ | ⚡ HQ | Daily briefing, Top 3, Radar deadlines, Project load |
| Projects | 💼 Projects | Proyectos por dominio, filtros, CRUD modal |
| Calendar | 📅 Calendar | Calendario mensual, journal por dia |
| Inbox | 📥 Inbox | Captura rapida, procesar items |
| Library | 🎬 Watch Later | Links guardados desde Telegram, filtros por tema |

---

## PERSONALIDAD DE KAIRA

- **Estilo:** Paisa (Medellin, Colombia)
- **Tono:** Cercana, coqueta, profesional
- **Expresiones:** "amor", "papasito", "mi cielo", "corazon", "bacano", "chimba"
- **LLM:** Claude Haiku 4.5 (antes GPT-4o-mini)
- **Voz:** ElevenLabs (Voice ID: 86V9x9hrQds83qf7zaGn)
- **Memoria:** Persistente en Supabase (tabla kaira_memory)
- **Historial:** 15 mensajes de sesion, reset tras 30 min inactividad

---

## FLUJO DE VOZ

```
Hablas → micro (WebM/MP4) → REST /transcribe → Whisper STT → texto
  → REST /chat-stream (SSE) → Claude Haiku (streaming + tool use)
    → sentences buffered → ElevenLabs TTS (fetched in parallel)
      → Phase 2: audio + typewriter text sincronizados
```

---

## QUE QUEDA POR HACER

### Prioridad Alta
- [ ] **Commit y push de todo el trabajo nuevo** — hay ~30 archivos sin commitear
- [ ] **Backend como servicio Windows** — ahora hay que arrancar manualmente tras reinicio
- [ ] **Pulir UI movil** — responsive, touch interactions

### Prioridad Media
- [ ] **Clonar voz definitiva** en ElevenLabs (tienes Creator este mes)
- [ ] **Notificaciones push** — Kaira avisa de deadlines
- [ ] **Kaira proactiva** — resumen al abrir la oficina (opcional, el prompt dice que no lo haga salvo que se pida)

### Prioridad Baja
- [ ] **Dashboard analytics** — graficos productividad
- [ ] **Integracion TradingView/MT5** — estado portfolios
- [ ] **Dark/light mode toggle**
- [ ] **Offline mode mejorado** — queue de acciones cuando no hay conexion

---

## URLS

| Recurso | URL |
|---------|-----|
| Oficina | https://kairoslaboffice.trade |
| API | https://www.kairoslaboffice.trade |
| Health | https://www.kairoslaboffice.trade/health |
| GitHub | https://github.com/KairoIA/Virtual_Office_KairosLab |
| Supabase | supabase.com/dashboard (Kairos_virtual_office) |
| Cloudflare | dash.cloudflare.com (tunnel: kairos-backend) |

---

## COMANDOS

```bash
# Arrancar todo
C:\Users\Administrator\Desktop\Virtual_Model_KairosLab\backend\start-kairos.bat

# Backend solo
cd C:\Users\Administrator\Desktop\Virtual_Model_KairosLab\backend && node server.js

# Frontend solo
cd C:\Users\Administrator\Desktop\Virtual_Model_KairosLab && http-server . -p 5500 -c-1 --cors

# Git push
cd C:\Users\Administrator\Desktop\Virtual_Model_KairosLab
git add -A && git commit -m "descripcion" && git push origin main
```

---

## CAMBIOS CLAVE ENTRE SESIONES (por Javi)

1. **LLM migrado de GPT-4o-mini a Claude Haiku 4.5** (Anthropic)
2. **Telegram bot** integrado para recibir links → Watch Later
3. **Frontend V2** con navegacion por tabs (HQ, Projects, Calendar, Inbox, Library)
4. **25 funciones de Kaira** (vs 7 originales)
5. **Memoria persistente** — Kaira recuerda info personal entre sesiones
6. **Gastos, listas, diario de actividad, contenido guardado, recurrentes, busqueda web**
7. **Avatar de Kaira** en el chat y FAB
8. **Error classifier** — detecta errores de billing/auth de APIs
9. **Historial de conversacion** — 15 mensajes con timeout de 30 min
10. **Schema V3** en Supabase con ~15 tablas
