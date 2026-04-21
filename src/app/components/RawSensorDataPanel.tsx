import { Activity, Gauge, Thermometer, Waves, Zap } from "lucide-react";
import type { RawSensorMeasurement } from "../lib/backendClient";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type RawSensorDataPanelProps = {
  latest: RawSensorMeasurement | null;
  recentMeasurements: RawSensorMeasurement[];
};

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits);
}

const metricCards = [
  {
    key: "voltage",
    label: "Voltage",
    icon: Zap,
    unit: "V",
    digits: 1,
  },
  {
    key: "current",
    label: "Current",
    icon: Activity,
    unit: "A",
    digits: 2,
  },
  {
    key: "reactivePower",
    label: "Reactive Power",
    icon: Waves,
    unit: "kVAr",
    digits: 2,
  },
  {
    key: "temperature",
    label: "Temperature",
    icon: Thermometer,
    unit: "°C",
    digits: 1,
  },
] as const;

export function RawSensorDataPanel({
  latest,
  recentMeasurements,
}: RawSensorDataPanelProps) {
  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg">Raw Sensor Snapshot</h3>
          <p className="text-sm text-slate-600">
            Live operational telemetry streamed from backend-processed records.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {latest ? `Latest ${latest.timestamp}` : "Waiting for sensor data"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const value = latest ? latest[metric.key] : null;

          return (
            <div key={metric.key} className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-600">
                <Icon className="size-4" />
                <span className="text-sm">{metric.label}</span>
              </div>
              <div className="text-2xl">
                {value === null ? "--" : `${formatNumber(value, metric.digits)} ${metric.unit}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-slate-600">
            <Gauge className="size-4" />
            <span className="text-sm">Power Factor</span>
          </div>
          <div className="text-xl">
            {latest ? formatNumber(latest.powerFactor, 3) : "--"}
          </div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="mb-1 text-sm text-slate-600">Power Consumption</div>
          <div className="text-xl">
            {latest ? `${formatNumber(latest.powerConsumption, 2)} kW` : "--"}
          </div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="mb-1 text-sm text-slate-600">Humidity</div>
          <div className="text-xl">
            {latest ? `${formatNumber(latest.humidity, 1)} %` : "--"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-base">Recent Measurements</h4>
          <p className="text-sm text-slate-600">
            The newest backend-processed sensor rows, ordered from latest to oldest.
          </p>
        </div>

        <ScrollArea className="h-72 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Voltage</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Power</TableHead>
                <TableHead>Reactive</TableHead>
                <TableHead>PF</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Humidity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMeasurements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-slate-500">
                    No sensor rows processed yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentMeasurements.map((measurement) => (
                  <TableRow key={measurement.timestamp}>
                    <TableCell>{measurement.timestamp}</TableCell>
                    <TableCell>{formatNumber(measurement.voltage, 1)} V</TableCell>
                    <TableCell>{formatNumber(measurement.current, 2)} A</TableCell>
                    <TableCell>{formatNumber(measurement.powerConsumption, 2)} kW</TableCell>
                    <TableCell>{formatNumber(measurement.reactivePower, 2)} kVAr</TableCell>
                    <TableCell>{formatNumber(measurement.powerFactor, 3)}</TableCell>
                    <TableCell>{formatNumber(measurement.temperature, 1)} °C</TableCell>
                    <TableCell>{formatNumber(measurement.humidity, 1)} %</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </Card>
  );
}
