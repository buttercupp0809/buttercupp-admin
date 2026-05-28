"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: {
    llmMessages: number;
    voiceNotes: number;
    imageGens: number;
    voiceTranscriptions: number;
    imageAnalysis: number;
    aiInitiated: number;
  };
}

export function UsageChart({ data }: Props) {
  const chartData = [
    { name: "LLM Messages", value: data.llmMessages },
    { name: "Voice Notes", value: data.voiceNotes },
    { name: "Voice Transcriptions", value: data.voiceTranscriptions },
    { name: "Image Gens", value: data.imageGens },
    { name: "Image Analysis", value: data.imageAnalysis },
    { name: "AI Initiated", value: data.aiInitiated },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#1D9EFF" name="Count" />
      </BarChart>
    </ResponsiveContainer>
  );
}
