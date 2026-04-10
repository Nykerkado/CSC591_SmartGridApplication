import { useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Play, Pause, RotateCcw, Upload } from "lucide-react";
import type { SimulationStatus } from "../lib/smartGrid";

type SimulationControlsProps = {
  error?: string;
  fileName: string;
  isUploading?: boolean;
  onPause: () => void;
  onReset: () => void | Promise<void>;
  onResume: () => void;
  onStart: () => void;
  onUpload: (file: File) => void | Promise<void>;
  processedCount: number;
  progress: number;
  status: SimulationStatus;
  totalRows: number;
};

export function SimulationControls({
  error,
  fileName,
  isUploading = false,
  onPause,
  onReset,
  onResume,
  onStart,
  onUpload,
  processedCount,
  progress,
  status,
  totalRows,
}: SimulationControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await onUpload(file);
    event.target.value = "";
  };

  const statusLabel =
    status === "running"
      ? "Simulation Running"
      : status === "paused"
      ? "Simulation Paused"
      : status === "completed"
      ? "Simulation Completed"
      : "Ready to Start";

  const statusDotClass =
    status === "running"
      ? "bg-green-500 animate-pulse"
      : status === "paused"
      ? "bg-yellow-500"
      : status === "completed"
      ? "bg-blue-500"
      : "bg-slate-300";

  return (
    <Card className="p-4 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left side - Status and Progress */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${statusDotClass}`} />
              <span className="text-sm font-medium">{statusLabel}</span>
            </div>
            <span className="text-xs text-slate-500">
              {totalRows > 0 ? `${progress}% complete` : "No data loaded"}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>{fileName ? `File: ${fileName}` : "Upload a CSV to begin"}</span>
            <span>{processedCount.toLocaleString()} rows processed</span>
            <span>{totalRows.toLocaleString()} rows total</span>
          </div>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpload}
            disabled={status === "running" || isUploading}
          >
            <Upload className="size-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload CSV"}
          </Button>

          {status === "idle" || status === "paused" ? (
            <Button
              size="sm"
              onClick={status === "idle" ? onStart : onResume}
              disabled={totalRows === 0 || progress === 100}
            >
              <Play className="size-4 mr-2" />
              {status === "idle" ? "Start" : "Resume"}
            </Button>
          ) : status === "completed" ? (
            <Button size="sm" disabled>
              <Play className="size-4 mr-2" />
              Completed
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onPause}>
              <Pause className="size-4 mr-2" />
              Pause
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={status === "idle" && progress === 0}
          >
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </Card>
  );
}
