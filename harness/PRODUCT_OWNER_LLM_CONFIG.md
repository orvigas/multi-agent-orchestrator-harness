# 🚀 Product Owner Agent — LLM Configuration Guide

Configura el Product Owner Agent para usar diferentes proveedores y modelos de IA.

---

## 📋 Tabla de Contenidos

1. [Quick Start](#quick-start)
2. [Modos de Operación](#modos-de-operación)
3. [Configuración de Proveedores](#configuración-de-proveedores)
4. [Roles y Modelos](#roles-y-modelos)
5. [Presupuesto y Límites](#presupuesto-y-límites)
6. [Características Configurables](#características-configurables)
7. [Ejemplos Completos](#ejemplos-completos)

---

## ⚡ Quick Start

### Activar LLM Mode

```bash
# En harness/.env
PO_MODE=llm
```

O desde línea de comandos:

```bash
PO_MODE=llm npm run po:create
```

### Cambiar Modelo para Generador de Tickets

Edita `harness/config/product-owner.yml`:

```yaml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-opus-5      # ← Cambiar aquí
    maxTokens: 2048
```

---

## 🔄 Modos de Operación

### Deterministic Mode (Por Defecto)

```bash
PO_MODE=deterministic npm run po:create
```

**Características:**
- ✅ Sin costo de API
- ✅ Reproducible
- ✅ Rápido
- ❌ Heurísticas simples
- ❌ Sin refinamiento inteligente

**Usa:**
- Lógica de complejidad fija
- Criterios de aceptación templates
- División basada en reglas simples

### LLM Mode

```bash
PO_MODE=llm npm run po:create
```

**Características:**
- ✅ Refinamiento inteligente
- ✅ Criterios de aceptación mejorados
- ✅ Complejidad estimada con IA
- ✅ Divisiones más inteligentes
- ❌ Requiere API key
- ❌ Costo por uso

**Usa:**
- Claude (Anthropic) o GPT (OpenAI)
- Análisis de complejidad
- Generación de preguntas
- Criterios mejorados

---

## 🔌 Configuración de Proveedores

### Opciones Disponibles

#### 1. Anthropic (Recomendado)

```yaml
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: https://api.anthropic.com
```

**Modelos disponibles:**
- `claude-opus-5` — Mejor calidad, más lento y caro
- `claude-sonnet-5` — Balance precio/calidad
- `claude-haiku-4-5` — Más rápido, más barato

#### 2. OpenAI

```yaml
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
```

**Modelos disponibles:**
- `gpt-4o` — Mejor calidad
- `gpt-4-turbo` — Balance
- `gpt-3.5-turbo` — Más barato

#### 3. OpenRouter

```yaml
providers:
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
    baseUrl: https://openrouter.ai/api/v1
```

**Modelos:** Acceso a múltiples proveedores

### Configurar en .env

```bash
# harness/.env
ANTHROPIC_API_KEY=sk-ant-v0-xxxxx
OPENAI_API_KEY=sk-xxx
OPENROUTER_API_KEY=sk-or-xxx
```

---

## 👥 Roles y Modelos

### Roles del Product Owner Agent

```yaml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-opus-5
    maxTokens: 2048
    description: Genera tickets de alta calidad

  requirement_refiner:
    provider: anthropic
    model: claude-sonnet-5
    maxTokens: 1024
    description: Refina requisitos con preguntas

  task_analyzer:
    provider: anthropic
    model: claude-sonnet-5
    maxTokens: 1024
    description: Analiza complejidad y división

  acceptance_criteria_generator:
    provider: anthropic
    model: claude-sonnet-5
    maxTokens: 1024
    description: Genera criterios BDD
```

### Personalizar Roles

Edita `harness/config/product-owner.yml`:

```yaml
roles:
  ticket_generator:
    provider: openai                # Cambiar proveedor
    model: gpt-4o                   # Cambiar modelo
    maxTokens: 3000                 # Cambiar límite de tokens
```

### Usar Modelos Más Baratos

```yaml
roles:
  requirement_refiner:
    provider: anthropic
    model: claude-haiku-4-5         # Más barato para tareas simples
    maxTokens: 512

  task_analyzer:
    provider: openai
    model: gpt-3.5-turbo            # GPT 3.5 es muy barato
    maxTokens: 512
```

---

## 💰 Presupuesto y Límites

### Configurar Presupuesto

```yaml
budget:
  perSession: 2.00      # $ por sesión (crear tickets)
  monthly: 500.00       # $ por mes
  warnAt: 80            # Advertencia al 80%
```

### Ejemplo: Setup Económico

```yaml
budget:
  perSession: 0.50      # Solo $0.50 por sesión
  monthly: 100.00       # $100/mes máximo
  warnAt: 75            # Advertencia temprano
```

### Monitorear Gasto

```bash
npm run po:stats        # Incluye estimación de costo
```

---

## ⚙️ Características Configurables

### Activar/Desactivar Features

```yaml
features:
  # Usar LLM para refinar requerimientos
  llmRefinement: true

  # Generar criterios de aceptación con LLM
  llmAcceptanceCriteria: true

  # Estimar complejidad con IA
  llmComplexityAnalysis: true

  # Sugerir división inteligente
  llmTaskDivision: true

  # Características experimentales
  experimental: false
```

### Deshabilitar Feature Específica

Para ahorrar costos, desactiva features que no uses:

```yaml
features:
  # Desactivar aceptación criteria con LLM (usar heurísticas)
  llmAcceptanceCriteria: false

  # Desactivar análisis de complejidad (usar heurísticas)
  llmComplexityAnalysis: false
```

### Generar Preguntas Adicionales

```yaml
refinement:
  questions:
    - functionality
    - useCases
    - priority
    - restrictions
    - beneficiaries

  # Generar 2-3 preguntas extras con LLM
  generateAdditionalQuestions: true
  maxAdditionalQuestions: 3
```

---

## 📝 Ejemplos Completos

### Ejemplo 1: Setup Económico (Deterministic)

```bash
PO_MODE=deterministic npm run po:create
```

**No cuesta nada, usa heurísticas.**

---

### Ejemplo 2: Setup Estándar (LLM)

```yaml
# product-owner.yml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-sonnet-5      # Balance precio/calidad
    maxTokens: 2048

budget:
  perSession: 1.00
  monthly: 300.00
```

```bash
PO_MODE=llm npm run po:create
```

**~$0.50-$1.00 por ticket, buena calidad.**

---

### Ejemplo 3: Setup Premium (Máxima Calidad)

```yaml
# product-owner.yml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-opus-5        # Mejor modelo
    maxTokens: 4096

  acceptance_criteria_generator:
    provider: anthropic
    model: claude-opus-5        # Mejor para criterios

features:
  llmRefinement: true
  llmAcceptanceCriteria: true
  llmComplexityAnalysis: true
  llmTaskDivision: true

budget:
  perSession: 5.00              # Budget mayor
  monthly: 1000.00
```

```bash
PO_MODE=llm npm run po:create
```

**~$2-$5 por ticket, máxima calidad.**

---

### Ejemplo 4: Setup Multi-Proveedor

Usa diferentes proveedores para diferentes tareas:

```yaml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-opus-5        # Mejor para generación

  requirement_refiner:
    provider: openai
    model: gpt-3.5-turbo        # Más barato para refinar

  task_analyzer:
    provider: openrouter
    model: mistral-large        # Alternativa económica
```

---

## 🔍 Monitorear Uso

### Ver Configuración Actual

```bash
# Carga la config desde product-owner.yml
cat harness/config/product-owner.yml
```

### Ver Modo Actual

```bash
echo $PO_MODE  # deterministic o llm
```

### Modo Fallback

Si LLM falla, automáticamente vuelve a heurísticas:

```yaml
modes:
  llm:
    fallbackToDeterministic: true  # Fallback automático
```

---

## 🚀 Casos de Uso

### Caso 1: Solo Crear Tickets (Deterministic)

```bash
PO_MODE=deterministic npm run po:create
```

**Ideal para:** Testing, desarrollo, sin presupuesto.

---

### Caso 2: Calidad vs Costo (Sonnet)

```yaml
roles:
  ticket_generator:
    model: claude-sonnet-5
```

**Ideal para:** Producción con presupuesto limitado.

---

### Caso 3: Máxima Calidad (Opus)

```yaml
roles:
  ticket_generator:
    model: claude-opus-5
```

**Ideal para:** Tickets críticos que necesitan perfección.

---

## 📊 Tabla de Modelos y Costos (Aproximado)

| Modelo | Proveedor | Costo | Velocidad | Calidad |
|--------|-----------|-------|-----------|---------|
| claude-opus-5 | Anthropic | $$$ | Lento | Excelente |
| claude-sonnet-5 | Anthropic | $$ | Rápido | Muy Buena |
| claude-haiku-4-5 | Anthropic | $ | Muy Rápido | Buena |
| gpt-4o | OpenAI | $$$ | Medio | Excelente |
| gpt-3.5-turbo | OpenAI | $ | Muy Rápido | Buena |
| mistral-large | OpenRouter | $$ | Rápido | Buena |

---

## ✅ Checklist de Configuración

- [ ] Crear `harness/.env` con API keys
- [ ] Editar `harness/config/product-owner.yml`
- [ ] Elegir modo: deterministic o llm
- [ ] Configurar roles y modelos
- [ ] Establecer presupuesto
- [ ] Activar/desactivar features
- [ ] Probar: `PO_MODE=llm npm run po:create`
- [ ] Monitorear costos con `npm run po:stats`

---

## 🔧 Troubleshooting

### "ANTHROPIC_API_KEY is required"

```bash
# Agregar a .env
echo "ANTHROPIC_API_KEY=sk-ant-v0-xxxxx" >> harness/.env
```

### "Model not found"

Verificar que el modelo existe en el proveedor.

### "Request timeout"

Aumentar `maxTokens` o cambiar a modelo más rápido.

### "Over budget"

Reducir `perSession` o cambiar a modelo más barato.

---

## 📚 Documentación Relacionada

- **PRODUCT_OWNER_AGENT.md** — Guía general
- **PRODUCT_OWNER_QUICK_START.md** — Inicio rápido
- **harness/config/providers.yml** — Definición de proveedores

---

**Versión:** 1.0  
**Status:** ✅ Production Ready  
**Última actualización:** 2026-07-30
