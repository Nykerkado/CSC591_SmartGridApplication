import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Play, Pause, RotateCcw, Upload } from "lucide-react";

type SimulationStatus = "idle" | "running" | "paused";

export function SimulationControls() {
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [progress, setProgress] = useState(0);

  const handleStart = () => {
    setStatus("running");
    // TODO: Connect to backend WebSocket/API
    console.log("Starting simulation...");
  };

  const handlePause = () => {
    setStatus("paused");
    // TODO: Pause backend data stream
    console.log("Pausing simulation...");
  };

  const handleResume = () => {
    setStatus("running");
    // TODO: Resume backend data stream
    console.log("Resuming simulation...");
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress(0);
    // TODO: Reset backend simulation
    console.log("Resetting simulation...");
  };

  const handleUpload = () => {
    // TODO: Open file upload dialog
    console.log("Upload CSV...");
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Status and Progress */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`size-2 rounded-full ${
                  status === "running"
                    ? "bg-green-500 animate-pulse"
                    : status === "paused"
                    ? "bg-yellow-500"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-sm font-medium">
                {status === "running"
                  ? "Simulation Running"
                  : status === "paused"
                  ? "Simulation Paused"
                  : "Ready to Start"}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {progress > 0 ? `${progress}% complete` : "No data loaded"}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpload}
            disabled={status === "running"}
          >
            <Upload className="size-4 mr-2" />
            Upload CSV
          </Button>

          {status === "idle" || status === "paused" ? (
            <Button
              size="sm"
              onClick={status === "idle" ? handleStart : handleResume}
              disabled={progress === 100}
            >
              <Play className="size-4 mr-2" />
              {status === "idle" ? "Start" : "Resume"}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={handlePause}>
              <Pause className="size-4 mr-2" />
              Pause
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={status === "idle" && progress === 0}
          >
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
    </Card>
  );
}
