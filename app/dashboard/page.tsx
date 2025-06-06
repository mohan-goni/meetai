"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";

// Mock data for demonstration
const kpis = [
  { title: "Market Growth", value: "15%", description: "vs. last quarter" },
  {
    title: "Competitor Activity",
    value: "3 new products",
    description: "in the last month",
  },
  {
    title: "Consumer Sentiment",
    value: "8.2/10",
    description: "positive feedback",
  },
  { title: "Market Share", value: "25%", description: "up from 22%" },
];

const marketTrendsData = [
  { name: "Jan", value: 4000 },
  { name: "Feb", value: 3000 },
  { name: "Mar", value: 2000 },
  { name: "Apr", value: 2780 },
  { name: "May", value: 1890 },
  { name: "Jun", value: 2390 },
];

const competitorAnalysisData = [
  { name: "Comp A", revenue: 4000 },
  { name: "Comp B", revenue: 3000 },
  { name: "Comp C", revenue: 2000 },
  { name: "Comp D", revenue: 2780 },
];

export default function DashboardPage() {
  // Implement actual data fetching logic here
  const handleRefreshData = () => {
    console.log("Refreshing data...");
    // Trigger data refetching (e.g., using a server action or client-side fetch)
  };

  return (
    <div className="flex flex-col space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={handleRefreshData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Market Trends</CardTitle>
            <CardDescription>Monthly Market Value/Growth</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{}}
              className="aspect-auto h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marketTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competitor Analysis</CardTitle>
            <CardDescription>Revenue Comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{}}
              className="aspect-auto h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competitorAnalysisData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
