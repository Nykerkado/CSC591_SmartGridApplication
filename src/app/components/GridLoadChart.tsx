import { Card } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import type { GridLoadPoint } from "../lib/smartGrid";

type GridLoadChartProps = {
  data: GridLoadPoint[];
};

export function GridLoadChart({ data }: GridLoadChartProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="size-5 text-purple-600" />
        <div>
          <h3>Grid Load Analysis</h3>
          <p className="text-sm text-slate-600">Current load vs. capacity (MW)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="load" fill="#8b5cf6" name="Current Load" />
          <Bar dataKey="capacity" fill="#e9d5ff" name="Total Capacity" />
        </BarChart>
      </ResponsiveContainer>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Grid load analysis updates as the stream builds hourly averages.
        </p>
      ) : null}
    </Card>
  );
}
