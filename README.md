# CSC591_SmartGridApplication

Smart Grid Monitoring Application with grounded OpenAI Q&A.

## Architecture note

- Current state: dashboard simulation and analytics are still largely frontend-driven.
- Target state: ingestion, cleaning, aggregation, fluctuation analytics, and risk scoring move to the backend.
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
- `npm test`: runs assistant analytics and chat API tests

## Grounded assistant behavior

- The assistant only answers from the uploaded smart-grid analytics.
- Full CSV data stays in the browser.
- The server receives only a compact derived analytics snapshot plus the user question.
- If no rows have been processed yet, the assistant tells the user to upload/start the simulation first.
