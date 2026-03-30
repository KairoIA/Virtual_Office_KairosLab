# KAIROS LAB — Virtual Office
## Sesion 27 Marzo 2026 — Parte 2

---

## RESUMEN

Sesion masiva de expansion. Se paso de V1 (agenda basica) a V4 (oficina virtual completa con IA proactiva). Se implemento bot de Telegram, sistema de contenido guardado, memoria persistente, listas, diario de actividad, busqueda web, notas post-it, plan diario inteligente, prioridades, categorias, y autoconciencia de Kaira.

---

## CAMBIOS PRINCIPALES DE ESTA SESION

### 1. Modelo de IA: GPT-4o-mini → Claude Haiku 4.5
- Mejor comprension, interpretacion de frases vagas, function calling
- Coste: ~$3-5/mes (vs $0.70 anterior)
- STT sigue siendo OpenAI (gpt-4o-transcribe)

### 2. STT mejorado
- Whisper → gpt-4o-transcribe (gratis, misma API)
- Prompt de contexto ampliado: trading, IA, dev, vida cotidiana

### 3. Memoria de sesion + persistente
- Session memory: 15 mensajes (reducido de 40 para ahorrar tokens)
- Persistent memory: tabla kaira_memory en Supabase, se inyecta en cada request
- Kaira guarda automaticamente info personal, preferencias, personas

### 4. Bot de Telegram (@KairaKairosBot)
- Token: en backend/.env
- Recibe links → los clasifica por tema y source → los guarda en saved_content
- Texto sin link → va al inbox
- Comandos: /start, /pending, /topics, /inbox
- Se arranca automaticamente con el backend

### 5. Watch Later (contenido guardado)
- Vista nueva en la oficina: pestaña "Watch Later"
- Filtros por tema: IA, Trading, Dev, Crypto, Bets, Health, Productivity, General
- Marcar como revisado, eliminar
- Kaira sabe consultar y gestionar contenido guardado

### 6. V4 — Reestructuracion completa

#### Categorias en todo
- Trading, Dev, IA, Bets, Personal, General
- Reminders, tasks, journal, notes, plan diario — todo tiene categoria

#### Prioridades opcionales
- green (tranquilo), yellow (atento), red (urgente)
- En reminders, tasks y plan diario
- Visual: borde izquierdo de color en el plan

#### FOR TODAY (Daily Plan)
- Reemplaza Top 3: hasta 10 items por dia
- Cada item tiene: texto, categoria, proyecto, energia, prioridad
- Kaira puede construir el plan proactivamente con build_daily_plan
- Analiza: deadlines, overdue, tareas sin terminar de ayer, proyectos, contenido pendiente
- move_plan_item para mover tareas a otro dia

#### Notas / Post-its
- Tabla notes: texto, categoria, proyecto (opcional), color, pinned
- add_note, get_notes, delete_note
- Para anotaciones rapidas que no son tarea ni journal

#### Journal expandido
- Kaira DESARROLLA lo que el jefe le dice brevemente en un journal bien redactado
- Journal vinculado a categoria y proyecto → crea documentacion del proyecto
- get_project_docs para ver toda la documentacion de un proyecto

#### Proyectos mejorados
- completed_at: proyectos completados quedan archivados
- Documentacion por proyecto: journals, notas, tareas, reminders vinculados

#### Radar mejorado
- Horizontes: Overdue, Hoy, 3 dias, Semana, Mes, Sin fecha
- Indicadores de prioridad por color

#### Kaira con autoconciencia
- Bio completa: 23 anos, paisa, ojos verdes, pelo rubio, intereses, personalidad
- Sabe que su foto esta en el avatar del chat y en Telegram
- Proactiva: sugiere, ordena, toma iniciativa
- Memoria de aprendizaje (category='learning')

### 7. UI Updates
- Fondo: particulas flotantes (reemplaza velas antiguas)
- Logo KairosLab en nav con branding dorado + "SMART OFFICE"
- Avatar de Kaira como boton del chat y en header del chat
- Favicon en URL
- PWA manifest actualizado con logo app
- Botones export/import eliminados (datos en Supabase)
- Side panel eliminado (Kaira gestiona todo)
- HQ renombrado a Dashboard

### 8. Carpeta renombrada
- Virtual_Model_KairosLab → KairosLab_Virtual_Office
- start-kairos.bat actualizado

---

## ESTADO ACTUAL DE LA BASE DE DATOS

### Tablas Supabase
| Tabla | Version | Descripcion |
|-------|---------|-------------|
| journal | V1 | Diario (+ category, project_id en V4) |
| reminders | V1 | Recordatorios (+ category, priority en V4) |
| tasks | V1 | Tareas backlog (+ category, priority en V4) |
| completed | V1 | Historial completados |
| projects | V2 | Proyectos (+ completed_at en V4) |
| inbox | V2 | Captura rapida |
| daily_plan | V4 | Plan diario hasta 10 items (reemplaza daily_top3) |
| expenses | V2 | Registro gastos |
| kaira_memory | V3 | Memoria persistente |
| lists | V3 | Listas custom |
| list_items | V3 | Items de listas |
| activity_log | V3 | Diario de actividad |
| saved_content | V3 | Contenido guardado (Watch Later) |
| recurring_reminders | V3 | Recordatorios recurrentes |
| notes | V4 | Notas post-it |

---

## FUNCIONES DE KAIRA (~30 tools)

### Core
add_reminder (con category, priority), add_task (con category, priority), complete_item, delete_item, write_journal (con category, project_id, expansion), get_agenda, search_entries

### Projects & Plan
create_project, update_project, get_project_docs, set_daily_plan, build_daily_plan, move_plan_item, add_to_inbox, get_briefing

### Notes
add_note, get_notes, delete_note

### Expenses
log_expense, get_expenses

### Memory & Intelligence
save_memory (con category='learning'), recall_memory, web_search

### Lists & Activity
manage_list, log_activity, get_activity_summary

### Content
save_content, get_saved_content, mark_content_reviewed

### Recurring
create_recurring, list_recurring

---

## PENDIENTE PARA PROXIMA SESION

### En progreso
- [ ] **Clonar voz de Kaira** — Audio MP3 descargado (Voz_paisa.mp3, 80MB, 1h). Falta:
  1. Instalar PyAnnote: `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu` y luego `pip install pyannote.audio pydub`
  2. Crear script separacion de voces (aislar mujer del podcast)
  3. Subir a ElevenLabs Professional Clone
  4. Cambiar Voice ID en .env

### Por hacer
- [ ] **Backend como servicio Windows** — Si VPS reinicia, hay que arrancar manual
- [ ] **Push notifications** — Que Kaira avise de deadlines
- [ ] **Vista Projects** — Mejorar para mostrar documentacion, notas, tareas por proyecto
- [ ] **Seccion Personal** — Implementar "secciones" en vez de proyectos (lista compra, etc)
- [ ] **UI mobile** — Revisar responsive en movil
- [ ] **Git push** — Subir cambios al repo

---

## COSTES MENSUALES

| Servicio | Coste |
|----------|-------|
| Claude Haiku (chat) | ~$3-5 |
| OpenAI STT (voz) | ~$1-3 |
| ElevenLabs Starter | $5 |
| Dominio | ~$0.35 |
| Supabase | $0 |
| Telegram Bot | $0 |
| **TOTAL (sin VPS)** | **~$9-13/mes** |

---

## COMANDOS ARRANQUE

```bash
cd C:\Users\Administrator\Desktop\KairosLab_Virtual_Office\backend
node server.js

cd C:\Users\Administrator\Desktop\KairosLab_Virtual_Office
http-server . -p 5500 -c-1 --cors
```

O usar: `C:\Users\Administrator\Desktop\KairosLab_Virtual_Office\backend\start-kairos.bat`
