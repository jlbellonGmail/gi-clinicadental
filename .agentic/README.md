# Configuración agentic canónica

`.agentic/` es la fuente normativa para roles, modelos, MCP y schemas. Los
adaptadores de Claude, Codex y OpenCode no deben introducir reglas propias. Los
nombres `*-agent` se conservan como adaptadores históricos; Planner, Builder y
Reviewer canónicos apuntan a `.agentic/roles/`.

MCP queda deliberadamente vacío. GitHub, Supabase, Serena/código y Vercel se
evaluarán sólo ante una necesidad concreta y con permisos mínimos.

Procedencia adoptada: Template v2.0.0 (`f5d4b6cc029c34c0d0c05831bfd28134276fa167`).
