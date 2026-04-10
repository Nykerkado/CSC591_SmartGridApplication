import { useEffect, useMemo, useRef, useState } from "react";
import {
  appendRecords,
  clearSimulationDatabase,
  loadRecords,
  loadSession,
  saveSession,
} from "../lib/smartGridDb";
import {
  buildEnergyDistributionData,
  buildGridLoadData,
  buildPowerConsumptionData,
  buildRenewableEnergyData,
  getSimulationStats,
  parseSmartGridCsv,
  type SimulationSession,
  type SimulationStatus,
  type SmartGridRecord,
} from "../lib/smartGrid";

const BATCH_SIZE = 1;
const STREAM_INTERVAL_MS = 250;

export function useSmartGridSimulation() {
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [uploadedRows, setUploadedRows] = useState<SmartGridRecord[]>([]);
  const [processedRows, setProcessedRows] = useState<SmartGridRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const processedCountRef = useRef(0);
  const rowsRef = useRef<SmartGridRecord[]>([]);
  const rawCsvRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const [session, records] = await Promise.all([loadSession(), loadRecords()]);

        if (cancelled || !session) {
          return;
        }

        const rows = parseSmartGridCsv(session.sourceCsv);
        rawCsvRef.current = session.sourceCsv;
        rowsRef.current = rows;
        processedCountRef.current = session.processedCount;
        setUploadedRows(rows);
        setProcessedRows(records);
        setFileName(session.fileName);
        setStatus(session.status);
      } catch (restoreError) {
        console.error("Failed to restore simulation session", restoreError);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextBatch = rowsRef.current.slice(
        processedCountRef.current,
        processedCountRef.current + BATCH_SIZE
      );

      if (nextBatch.length === 0) {
        setStatus("completed");
        return;
      }

      processedCountRef.current += nextBatch.length;
      setProcessedRows((current) => {
        const updated = [...current, ...nextBatch];
        void appendRecords(nextBatch);
        void saveSession({
          id: "current",
          fileName,
          totalRows: rowsRef.current.length,
          processedCount: processedCountRef.current,
          status:
            processedCountRef.current >= rowsRef.current.length ? "completed" : "running",
          uploadedAt: new Date().toISOString(),
          sourceCsv: rawCsvRef.current,
        });
        return updated;
      });

      if (processedCountRef.current >= rowsRef.current.length) {
        setStatus("completed");
      }
    }, STREAM_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fileName, status]);

  useEffect(() => {
    if (!isLoading && fileName) {
      void saveSession({
        id: "current",
        fileName,
        totalRows: uploadedRows.length,
        processedCount: processedRows.length,
        status,
        uploadedAt: new Date().toISOString(),
        sourceCsv: rawCsvRef.current,
      });
    }
  }, [fileName, isLoading, processedRows.length, status, uploadedRows.length]);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setError("");

    try {
      const rawCsv = await file.text();
      const parsedRows = parseSmartGridCsv(rawCsv);

      if (parsedRows.length === 0) {
        throw new Error("The uploaded CSV did not contain any data rows.");
      }

      rawCsvRef.current = rawCsv;
      rowsRef.current = parsedRows;
      processedCountRef.current = 0;
      setUploadedRows(parsedRows);
      setProcessedRows([]);
      setFileName(file.name);
      setStatus("idle");

      await clearSimulationDatabase();
      await saveSession({
        id: "current",
        fileName: file.name,
        totalRows: parsedRows.length,
        processedCount: 0,
        status: "idle",
        uploadedAt: new Date().toISOString(),
        sourceCsv: rawCsv,
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload the CSV file.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  function start() {
    if (rowsRef.current.length === 0) {
      setError("Upload a CSV file before starting the simulation.");
      return;
    }

    if (processedCountRef.current >= rowsRef.current.length) {
      return;
    }

    setError("");
    setStatus("running");
  }

  function pause() {
    setStatus("paused");
  }

  function resume() {
    if (processedCountRef.current < rowsRef.current.length) {
      setStatus("running");
    }
  }

  async function reset() {
    setStatus("idle");
    setUploadedRows([]);
    setProcessedRows([]);
    setFileName("");
    setError("");
    rowsRef.current = [];
    rawCsvRef.current = "";
    processedCountRef.current = 0;
    await clearSimulationDatabase();
  }

  const progress =
    uploadedRows.length === 0
      ? 0
      : Math.round((processedRows.length / uploadedRows.length) * 100);

  const powerConsumptionData = useMemo(
    () => buildPowerConsumptionData(processedRows),
    [processedRows]
  );
  const renewableEnergyData = useMemo(
    () => buildRenewableEnergyData(processedRows),
    [processedRows]
  );
  const gridLoadData = useMemo(() => buildGridLoadData(processedRows), [processedRows]);
  const energyDistributionData = useMemo(
    () => buildEnergyDistributionData(processedRows),
    [processedRows]
  );
  const stats = useMemo(() => getSimulationStats(processedRows), [processedRows]);

  return {
    error,
    fileName,
    gridLoadData,
    energyDistributionData,
    isLoading,
    isUploading,
    pause,
    powerConsumptionData,
    processedCount: processedRows.length,
    progress,
    renewableEnergyData,
    reset,
    resume,
    start,
    stats,
    status,
    totalRows: uploadedRows.length,
    uploadFile,
  };
}
