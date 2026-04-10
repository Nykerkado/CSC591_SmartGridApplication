import { Card } from "./ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import type { RenewablePoint } from "../lib/smartGrid";

type RenewableEnergyChartProps = {
  data: RenewablePoint[];
};

export function RenewableEnergyChart({ data }: RenewableEnergyChartProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="size-5 text-green-600" />
        <div>
          <h3>Renewable Energy Sources</h3>
          <p className="text-sm text-slate-600">Weekly generation by type (MW)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="solar" stackId="1" stroke="#f59e0b" fill="#fbbf24" name="Solar" />
          <Area type="monotone" dataKey="wind" stackId="1" stroke="#06b6d4" fill="#22d3ee" name="Wind" />
        </AreaChart>
      </ResponsiveContainer>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Renewable totals will accumulate here as each CSV row is processed.
        </p>
      ) : null}
    </Card>
  );
}
