# Backend Architecture Plan

## Goal

Move smart-grid ingestion, cleaning, aggregation, and analytics from the frontend into the backend so the system looks and behaves like a production analytics platform rather than a visualization-only demo.

Target data flow:

`sensor / CSV upload / database`
-> `backend ingestion`
-> `backend validation + cleaning + aggregation`
-> `analytics API`
-> `frontend dashboard + grounded chat`

## Why This Change Matters

The current project proves visualization and grounded Q&A, but most data handling still happens in the browser.

That is useful for a demo, but it does not demonstrate these product capabilities strongly enough:

- Can the system accept external data?
- Can the backend validate and clean incoming records?
- Can the backend aggregate and derive analytics?
- Can the frontend consume backend-owned metrics and time series?

The redesigned backend makes those capabilities explicit.

## Current State

Today:

- CSV parsing happens in the frontend.
- Simulation progress is managed in the frontend.
- Derived KPIs and chart series are computed in the frontend.
- IndexedDB acts as local browser storage for the active session.
- The backend currently supports grounded chat only.

Relevant current files:

- `src/app/hooks/useSmartGridSimulation.ts`
- `src/app/lib/smartGrid.ts`
- `src/app/lib/assistantContext.ts`
- `server/index.ts`
- `server/chatService.ts`

## Target Architecture

### 1. Ingestion Layer

Responsible for accepting raw telemetry from uploads or future live sources.

Primary endpoints:

- `POST /api/ingest/csv`
- `POST /api/ingest/sensor`

Responsibilities:

- Receive payloads or file uploads
- Validate schema
- Parse timestamps and numeric fields
- Reject malformed rows
- Tag rows with source and ingestion job id
- Persist raw records

### 2. Storage Layer

Use a real backend persistence model instead of browser-only state.

Recommended tables:

#### `ingestion_jobs`

- `id`
- `source_type`
- `file_name`
- `status`
- `rows_received`
- `rows_processed`
- `started_at`
- `completed_at`
- `error_message`

#### `raw_measurements`

- `id`
- `ingestion_job_id`
- `source_id`
- `timestamp`
- `voltage`
- `current`
- `power_consumption`
- `reactive_power`
- `power_factor`
- `solar_power`
- `wind_power`
- `grid_supply`
- `voltage_fluctuation`
- `overload_condition`
- `transformer_fault`
- `temperature`
- `humidity`
- `electricity_price`
- `predicted_load`
- `created_at`

#### `aggregated_windows`

- `id`
- `window_start`
- `window_end`
- `window_size`
- `avg_load`
- `avg_capacity`
- `avg_voltage_fluctuation`
- `overload_count`
- `transformer_fault_count`
- `renewable_share`
- `risk_index`
- `risk_level`
- `latest_price`

#### `fault_events`

- `id`
- `measurement_id`
- `timestamp`
- `event_type`
- `severity`

### 3. Processing Layer

This is the core analytics capability.

Recommended backend services:

- `csvIngestService`
- `dataCleaningService`
- `aggregationService`
- `faultService`
- `fluctuationService`
- `riskIndexService`
- `dashboardAnalyticsService`

Responsibilities:

- Normalize incoming values
- Bucket rows into time windows
- Compute dashboard KPIs
- Derive chart-ready series
- Detect and summarize faults
- Build assistant-ready context for grounded chat

### 4. API Layer

Frontend should stop computing analytics locally and instead request backend-owned results.

Recommended endpoints:

- `GET /api/health`
- `POST /api/ingest/csv`
- `POST /api/ingest/sensor`
- `GET /api/jobs/:jobId`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/power-consumption`
- `GET /api/dashboard/grid-load`
- `GET /api/dashboard/renewables`
- `GET /api/dashboard/energy-distribution`
- `GET /api/dashboard/fluctuation`
- `GET /api/dashboard/risk-index`
- `GET /api/dashboard/fault-events`
- `POST /api/chat/query`

### 5. Frontend Layer

The frontend becomes a thin client:

- Upload files
- Poll or subscribe for job progress
- Request analytics from the backend
- Render charts
- Send backend-provided context into chat

The frontend should not:

- Parse CSV files directly
- Own the main simulation state
- Calculate business metrics
- Build final analytics payloads

## New Analytics

### Fluctuation Chart

Purpose:

- Show grid instability over time
- Highlight abnormal operation windows

Suggested backend metric:

- `fluctuation_score`

Suggested formula:

- start simple: average voltage fluctuation per time bucket
- enrich later with power factor drop and reactive power

Example:

`fluctuation_score = weighted(avg_voltage_fluctuation, overload_count, transformer_fault_count)`

Suggested API shape:

```json
{
  "series": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "fluctuationScore": 18.4,
      "avgVoltageFluctuation": 1.2,
      "overloadCount": 1,
      "transformerFaultCount": 0
    }
  ]
}
```

### Risk Index

Purpose:

- Expose a single operator-facing stability/risk score over time

Suggested backend metric:

- `risk_index` from `0-100`

Suggested formula:

`risk_index = 0.45 * overload_frequency + 0.35 * transformer_fault_frequency + 0.20 * normalized_fluctuation_score`

Suggested API shape:

```json
{
  "series": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "riskIndex": 62,
      "riskLevel": "medium"
    }
  ],
  "latest": {
    "riskIndex": 62,
    "riskLevel": "medium"
  }
}
```

## Processing Model

### Phase 1: CSV Replay Through Backend

This is the best next step for the current repo.

Flow:

1. Frontend uploads CSV to backend
2. Backend creates an ingestion job
3. Backend parses and stores raw rows
4. Backend replays rows into analytics windows
5. Frontend polls job progress and analytics endpoints

This already demonstrates:

- backend ingestion
- backend cleaning
- backend aggregation
- backend-owned analytics

### Phase 2: Real Sensor Stream

Future flow:

- sensors publish to a queue or push API
- backend workers persist raw telemetry
- aggregations update on a schedule or streaming basis
- frontend receives updated results via polling, SSE, or WebSocket

## Recommended Repo Structure

```txt
server/
  index.ts
  routes/
    healthRoutes.ts
  ingest/
    ingestRoutes.ts
    ingestSchemas.ts
    csvIngestService.ts
  analytics/
    analyticsRoutes.ts
    analyticsSchemas.ts
    dashboardAnalyticsService.ts
    fluctuationService.ts
    riskIndexService.ts
    faultService.ts
  storage/
    repositories.ts
  chat/
    chatService.ts
```

## Migration Plan

### Step 1

Move analytics calculation logic into backend services.

Do first:

- KPI calculations
- fault summaries
- chart series preparation
- fluctuation and risk index

### Step 2

Move CSV ingestion into backend.

Frontend changes:

- upload file to backend
- stop calling `File.text()` for business logic
- stop computing processed rows locally

### Step 3

Replace frontend IndexedDB session ownership with backend job ownership.

Frontend should only keep lightweight UI state:

- active job id
- selected role
- selected chart filters

### Step 4

Feed grounded chat from backend-generated assistant context instead of frontend-generated context.

## Suggested Demo Narrative

If you present this architecture, the message should be:

- The system accepts uploaded or live smart-grid telemetry
- The backend validates and cleans incoming records
- The backend computes operational analytics and risk-oriented metrics
- The frontend is only the presentation layer
- The architecture can scale from CSV replay to real streaming sensors

That makes the project look like a system platform, not just a chart demo.
