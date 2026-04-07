import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import {
  Zap,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Send,
  LogOut,
  Filter,
} from "lucide-react";
import { PowerConsumptionChart } from "../components/PowerConsumptionChart";
import { RenewableEnergyChart } from "../components/RenewableEnergyChart";
import { GridLoadChart } from "../components/GridLoadChart";
import { EnergySourceDistribution } from "../components/EnergySourceDistribution";
import { ChatInterface } from "../components/ChatInterface";
import { SimulationControls } from "../components/SimulationControls";

type ChartType = "power-consumption" | "renewable-energy" | "grid-load" | "energy-distribution";

const availableCharts = [
  { id: "power-consumption", label: "Power Consumption", icon: Activity },
  { id: "renewable-energy", label: "Renewable Energy", icon: TrendingUp },
  { id: "grid-load", label: "Grid Load", icon: BarChart3 },
  { id: "energy-distribution", label: "Energy Distribution", icon: PieChart },
];

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get("role") || "grid-operator";

  const [selectedCharts, setSelectedCharts] = useState<ChartType[]>([
    "power-consumption",
    "renewable-energy",
  ]);

  const handleChartToggle = (chartId: ChartType) => {
    setSelectedCharts((prev) =>
      prev.includes(chartId)
        ? prev.filter((id) => id !== chartId)
        : [...prev, chartId]
    );
  };

  const getRoleTitle = (roleId: string) => {
    const titles: Record<string, string> = {
      "grid-operator": "Grid Operator",
      "energy-analyst": "Energy Analyst",
      "system-admin": "System Administrator",
    };
    return titles[roleId] || "User";
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="size-6 text-blue-600" />
          <div>
            <h1 className="text-xl">Smart Grid Analytics</h1>
            <p className="text-sm text-slate-600">{getRoleTitle(role)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <LogOut className="size-4 mr-2" />
          Change Role
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Chart Filters */}
        <aside className="w-64 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="size-5 text-slate-600" />
              <h2 className="text-lg">Chart Selection</h2>
            </div>
            <p className="text-sm text-slate-600">Choose graphs to display</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {availableCharts.map((chart) => {
                const Icon = chart.icon;
                return (
                  <div key={chart.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={chart.id}
                      checked={selectedCharts.includes(chart.id as ChartType)}
                      onCheckedChange={() => handleChartToggle(chart.id as ChartType)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={chart.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="size-4 text-slate-600" />
                        <span className="text-sm">{chart.label}</span>
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setSelectedCharts(availableCharts.map(c => c.id as ChartType))}
            >
              Select All
            </Button>
          </div>
        </aside>

        {/* Main Content - Charts */}
        <main className="flex-1 overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Simulation Controls */}
              <SimulationControls />

              {selectedCharts.length === 0 ? (
                <Card className="p-12 text-center">
                  <BarChart3 className="size-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="mb-2">No Charts Selected</h3>
                  <p className="text-slate-600">
                    Select charts from the left sidebar to visualize grid data
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {selectedCharts.includes("power-consumption") && (
                    <PowerConsumptionChart />
                  )}
                  {selectedCharts.includes("renewable-energy") && (
                    <RenewableEnergyChart />
                  )}
                  {selectedCharts.includes("grid-load") && <GridLoadChart />}
                  {selectedCharts.includes("energy-distribution") && (
                    <EnergySourceDistribution />
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </main>

        {/* Right Sidebar - Chat Interface */}
        <ChatInterface />
      </div>
    </div>
  );
}