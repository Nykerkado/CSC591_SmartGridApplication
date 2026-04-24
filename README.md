# CSC591_SmartGridApplication

Smart Grid Monitoring Application with grounded OpenAI Q&A.

## Architecture note

- Current state: CSV ingestion, row-by-row processing, dashboard analytics, and grounded chat are backend-owned.
- Current storage: ingestion jobs and processed rows are stored in-memory on the backend.
- Target state: move backend storage to a persistent database for stronger reliability and uptime testing.
- Design document: `docs/backend-architecture.md`

## Local setup

1. Install dependencies:
   `npm install`
2. Create a local env file:
   `cp .env.example .env`
3. Add your OpenAI key to `.env`:
   `OPENAI_API_KEY=your_key_here`
4. Start the app and local chat API together:
   `npm run dev`
5. Open the Vite URL shown in the terminal.

## Available scripts

- `npm run dev`: starts the Vite client and the local Node chat API together
- `npm run dev:client`: starts the frontend only
- `npm run dev:server`: starts the local chat API only
- `npm run build`: builds the frontend
- `npm run build:server`: type-checks/emits the server build
- `npm run build:all`: builds the frontend and server for production
- `npm start`: serves the production client build and backend API from one Node process
- `npm test`: runs assistant analytics and chat API tests
- `npm run test:perf`: runs performance, accuracy, and uptime test suites
- `npm run test:report`: runs all test suites and saves output to `test-results/report.txt`
- `npm run perf:load`: runs HTTP load tests against a running server (requires `npm run dev:server` first)

## Running the tests

### All tests with a saved report

```bash
npm run test:report
```

Runs every test suite and writes the full output to `test-results/report.txt`. The results are also printed to the terminal.

### Functional tests only

```bash
npm test
```

Runs the chat API unit tests in `server/chatApi.test.ts`.

### Performance, accuracy, and uptime tests

```bash
npm run test:perf
```

Runs four suites without needing the server to be running:

- **Functional - Chat API**: validates the chat query handler returns correct responses, handles unsupported questions, and fails gracefully when OpenAI is unavailable.
- **Accuracy - Data Validation**: unit tests every analytics function in `smartGridAnalytics.ts` using hand-crafted fixtures, then confirms computed KPIs match ground-truth values derived from the full 50,000-row CSV.
- **Performance - Response Time**: asserts each API handler meets its latency SLA (health under 5 ms, analytics under 50 ms, ingest under 500 ms).
- **Uptime - System Availability**: calls each handler 100 times and asserts a 99% success rate. Also probes a live server if one is running.
- **Performance - Visualization Load**: parses all 50,000 CSV rows and runs every visualization builder function, asserting the full pipeline completes under 5 seconds.

### HTTP load test

Requires the server to be running first:

```bash
npm run dev:server
```

Then in a second terminal:

```bash
npm run perf:load
```

Three load profiles are available:

| Profile | Connections | Duration | Command |
|---|---|---|---|
| Default (baseline) | 10 | 10 s | `npm run perf:load` |
| Stress (peak load) | 50 | 30 s | `LOAD_PROFILE=stress npm run perf:load` |
| Soak (sustained) | 10 | 120 s | `LOAD_PROFILE=soak npm run perf:load` |

Pass/fail thresholds: p99 latency under 500 ms, error rate under 1%, throughput above 50 requests/sec.

## Docker deploy

1. Build the image:
   `docker build -t smart-grid-app .`
2. Run the container locally:
   `docker run --rm -p 8787:8787 --env-file .env smart-grid-app`
3. Open:
   `http://localhost:8787`

Notes:
- The container serves both the frontend dashboard and backend API.
- `OPENAI_API_KEY` should be provided through `.env` locally or a secret manager in the cloud.

## Cloud Run deploy

1. Build and push an amd64 image from Apple Silicon or any non-amd64 machine:
   `docker buildx build --platform linux/amd64 -t us-central1-docker.pkg.dev/PROJECT_ID/smart-grid-repo/smart-grid-app:latest --push .`
2. Deploy to Cloud Run:
   `gcloud run deploy smart-grid-app --image us-central1-docker.pkg.dev/PROJECT_ID/smart-grid-repo/smart-grid-app:latest --region us-central1 --platform managed --allow-unauthenticated --port 8787 --memory 1Gi --cpu 1 --max-instances 1`
3. Create the OpenAI secret if needed:
   `gcloud secrets create openai-api-key`
4. Grant the Cloud Run service account access to the secret:
   `gcloud secrets add-iam-policy-binding openai-api-key --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" --role="roles/secretmanager.secretAccessor"`
5. Mount the secret as `OPENAI_API_KEY`:
   `gcloud run services update smart-grid-app --region us-central1 --update-secrets OPENAI_API_KEY=openai-api-key:latest`

Notes:
- Cloud Run should usually stay at `--max-instances 1` for this version because backend data is in-memory.
- After changing env vars or secrets, Cloud Run creates a new revision.
- Verify the deployed service is using the secret with:
  `gcloud run services describe smart-grid-app --region us-central1 --format="yaml(spec.template.spec.containers)"`

## Grounded assistant behavior

- The assistant only answers from the uploaded smart-grid analytics.
- CSV upload, processing, analytics, and grounded chat all flow through the backend.
- If no rows have been processed yet, the assistant tells the user to upload/start the simulation first.
