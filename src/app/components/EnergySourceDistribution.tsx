import { Card } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { SourcePoint } from "../lib/smartGrid";

type EnergySourceDistributionProps = {
  data: SourcePoint[];
  renewableShare: number;
};

export function EnergySourceDistribution({
  data,
  renewableShare,
}: EnergySourceDistributionProps) {
  const colors = data.map((entry) => entry.color);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="size-5 text-orange-600" />
        <div>
          <h3>Energy Source Distribution</h3>
          <p className="text-sm text-slate-600">Current generation mix (%)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-sm text-slate-600">Renewable Share</p>
          <p className="text-2xl text-green-600">{renewableShare}%</p>
        </div>
        <div className="bg-slate-100 p-3 rounded-lg">
          <p className="text-sm text-slate-600">Grid Supply Share</p>
          <p className="text-2xl text-slate-600">{(100 - renewableShare).toFixed(2)}%</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Distribution is calculated from the cumulative energy already stored in the local database.
        </p>
      ) : null}
    </Card>
  );
}
