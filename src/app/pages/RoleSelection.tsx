import { useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Zap, TrendingUp, Settings } from "lucide-react";

const roles = [
  {
    id: "grid-operator",
    title: "Grid Operations Manager",
    description:
      "Monitor real-time grid conditions and manage operational decisions",
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    id: "energy-analyst",
    title: "Maintenance and Asset Manager",
    description:
      "Monitor transformer health and infrastructure reliability",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    id: "system-admin",
    title: "Energy Procurement and Market Analyst",
    description: "Monitor power demand and electricity prices",
    icon: Settings,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
];

export function RoleSelection() {
  const navigate = useNavigate();

  const handleRoleSelect = (roleId: string) => {
    navigate(`/dashboard?role=${roleId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Zap className="size-12 text-blue-600" />
          </div>
          <h1 className="mb-3">
            Smart Grid Analytics Platform
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Transform raw grid data into actionable insights.
            Monitor conditions, analyze trends, and make
            informed decisions with AI-assisted analytics.
          </p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="mb-2">Select Your Role</h2>
          <p className="text-slate-600">
            Choose your role to access the analytics dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card
                key={role.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleRoleSelect(role.id)}
              >
                <div
                  className={`${role.bgColor} size-16 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className={`size-8 ${role.color}`} />
                </div>
                <h3 className="mb-2">{role.title}</h3>
                <p className="text-slate-600 text-sm mb-6">
                  {role.description}
                </p>
                <Button className="w-full" variant="outline">
                  Select Role
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500">
          <p>Minimum Viable Product - v1.0</p>
        </div>
      </div>
    </div>
  );
}