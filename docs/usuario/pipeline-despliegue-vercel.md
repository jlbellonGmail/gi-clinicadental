# Pipeline de Despliegue Vercel — Guía de Usuario

## Propósito

Esta guía explica cómo el equipo utiliza los **despliegues Preview de Vercel** para auditar cambios técnicos y dar la **aprobación HITL (Human In The Loop)** antes de que cualquier cambio llegue al sitio público de producción.

## Flujo de Trabajo para el Equipo

### 1. Desarrollo en Rama `feature/*`
- Cada feature se desarrolla en su propia rama `feature/<NN>-<slug>` (en worktree separado).
- Los cambios se commitean y pushean a esa rama.
- **No hay despliegue automático** desde ramas `feature/*` (solo `develop` y `main` despliegan).

### 2. Pull Request hacia `develop` → Preview URL
Cuando se crea una **Pull Request hacia `develop`**:

```
┌────────────────────────────────────────────────────────────────┐
│  GitHub PR → develop                                           │
│         │                                                      │
│         ▼                                                      │
│  Vercel detecta PR → Build + Deploy Preview                   │
│         │                                                      │
│         ▼                                                      │
│  🎯 URL Preview generada (ej. https://gi-clinicadental-       │
│     git-develop-jlbel.vercel.app)                              │
│         │                                                      │
│         ▼                                                      │
│  Comentario automático en la PR con el enlace                 │
└────────────────────────────────────────────────────────────────┘
```

**Qué hacer con la Preview URL**:
1. **Abrir la URL** en navegador (desktop y móvil)
2. **Verificar visualmente**: landing page, formulario, estilos, responsive
3. **Probar el formulario**: completar y enviar un lead de prueba
4. **Verificar en Supabase**: que el lead se creó en tabla `leads` (panel Supabase)
5. **Verificar emails**: que llegó notificación a clínica y confirmación al paciente (usar emails de prueba)
6. **Revisar logs**: Vercel Dashboard → Functions → `/api/leads` para ver requests/responses

### 3. Aprobación HITL (Decisión Humana)

**La aprobación HITL es el único checkpoint humano obligatorio.** Ocurre **después** de:
- ✅ CI verde (GitHub Actions pasa)
- ✅ Preview URL funcional y verificada
- ✅ Auditoría técnica completada (revisión de código, seguridad, etc.)

**Quién aprueba**: Stakeholder técnico/producto designado (según proceso del equipo).

**Cómo se registra**: Comentario en la PR: `"APROBADO PARA MERGE — HITL OK"` o similar.

**Si NO se aprueba**: Se solicitan cambios → nuevo commit/push → nuevo Preview → nueva verificación.

### 4. Merge a `develop` → Nuevo Preview
- Tras aprobación HITL, se hace **Merge** de la PR a `develop`.
- Vercel genera un **nuevo deployment Preview** (commit de merge en `develop`).
- Este deployment valida que el merge no rompió nada.

### 5. Merge a `main` → Production (Release)
- Cuando se decide hacer un **release**, se crea PR `develop` → `main`.
- Tras aprobación HITL final, merge a `main`.
- Vercel despliega a **Production** automáticamente.
- El sitio público se actualiza: `https://gi-clinicadental.vercel.app` (o dominio custom).

## Checklist de Verificación en Preview URL

### Funcionalidad Core
- [ ] Landing page carga sin errores (consola limpia)
- [ ] Hero, stats, servicios, equipo, footer se ven correctos
- [ ] Navegación suave (scroll) funciona
- [ ] Animaciones de aparición al scroll funcionan
- [ ] Responsive: desktop, tablet, móvil

### Formulario de Leads (`#leadForm`)
- [ ] Campos: nombre, email, teléfono, servicio, mensaje
- [ ] Checkbox consentimiento privacidad **obligatorio**
- [ ] Validación client-side (requeridos, formato email, longitudes)
- [ ] Envío: botón se deshabilita, muestra "Enviando solicitud..."
- [ ] Éxito: mensaje "Solicitud recibida. La clínica se comunicará para confirmar el turno"
- [ ] Error rate limit: "Demasiados intentos, espere unos minutos"
- [ ] Error red: "Error en la conexión, intente más tarde"
- [ ] Botón siempre se reactiva al finalizar

### Backend (verificar en Supabase y logs)
- [ ] Lead insertado en tabla `leads` con estado `nuevo`
- [ ] Campos: nombre, email, telefono, servicio, mensaje, consentimiento_privacidad, version_politica_privacidad, origen=formulario_web
- [ ] `notificacion_clinica_enviada = true` tras email exitoso
- [ ] `confirmacion_paciente_enviada = true` tras email exitoso
- [ ] Rate limiting activo (intentar envíos rápidos → 429)
- [ ] Antispam: honeypot / control temporal funcionando

### Emails Transaccionales
- [ ] Notificación a clínica (`LEADS_NOTIFICATION_EMAIL`): HTML con datos del paciente
- [ ] Confirmación a paciente: recibo, aclara que turno no confirmado aún
- [ ] Enlaces en emails usan `SITE_URL` correcto (Preview URL en Preview)

### Accesibilidad y SEO
- [ ] Navegación por teclado (Tab, Enter, Escape)
- [ ] Contraste WCAG AA
- [ ] Labels asociados a inputs
- [ ] Mensajes de error accesibles (aria-live)
- [ ] Meta tags: title, description, Open Graph, canonical
- [ ] Favicon presente
- [ ] Página 404 coherente

## Comandos Útiles

### Ver deployments en Vercel CLI
```bash
# Listar deployments recientes
vercel list gi-clinicadental

# Ver logs de un deployment
vercel logs <deployment-url>

# Promover Preview a Production (solo si emergencia)
vercel promote <preview-url>
```

### Ver estado en GitHub
```bash
# Ver PRs abiertas hacia develop
gh pr list --base develop

# Ver checks de CI en una PR
gh pr checks <pr-number>
```

## Preguntas Frecuentes

**P: ¿Cuánto tarda en generarse la Preview URL?**
R: Típicamente 30-60 segundos tras abrir la PR. Vercel comenta automáticamente en la PR con el enlace.

**P: ¿Puedo probar en Preview sin crear PR?**
R: No. Solo PRs hacia `develop` y pushes directos a `develop` generan Preview. Para pruebas locales usa `vercel dev` o sirve archivos estáticos localmente.

**P: ¿Qué pasa si rompo algo en `develop`?**
R: Solo afecta al Preview de `develop`. Production (`main`) no se ve afectado. Fix: commit corregido en `develop` → nuevo Preview automático.

**P: ¿Las variables de entorno son iguales en Preview y Production?**
R: La mayoría sí, pero `SITE_URL` es diferente (Preview URL vs dominio Production). Secrets (SMTP_PASS, SUPABASE_SERVICE_ROLE_KEY) son distintos por ambiente por seguridad.

**P: ¿Cómo hago rollback en Production si algo sale mal?**
R: `git revert <commit> en main && git push origin main` → Vercel redeploya automáticamente la versión anterior. Ver docs técnicas para detalles.

**P: ¿Necesito configurar algo en Vercel para cada feature nueva?**
R: No. La configuración es una sola vez (este pipeline). Nuevas features solo requieren PR → develop → Preview → HITL → merge.

## Contacto y Escalación

- **Dudas técnicas**: Revisar `docs/tecnica/14-pipeline-despliegue-vercel.md`
- **Problemas de despliegue**: Vercel Dashboard → Deployments → Logs
- **Problemas de Supabase**: Panel Supabase → Table Editor → `leads` / Logs
- **Problemas de email**: Logs de función `/api/leads` en Vercel → Functions

## Referencias

- Spec: `runs/14-pipeline-despliegue-vercel/spec.md`
- Auditoría: `runs/14-pipeline-despliegue-vercel/audit-1.md`
- Decisiones: `runs/14-pipeline-despliegue-vercel/decision.md`
- Documentación técnica: `docs/tecnica/14-pipeline-despliegue-vercel.md`
- AGENTS.md: Sección "Circuito" paso 8 (HITL único)