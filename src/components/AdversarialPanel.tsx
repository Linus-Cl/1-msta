import React, { useState } from 'react';
import { Cpu, AlertTriangle, Loader2, Sparkles, Timer, Hash, Download } from 'lucide-react';
import { Preset, Coordinate } from '../types';

interface AdversarialPanelProps {
    onInstancesFound: (instances: Preset[], totalGenerated: number) => void;
    addLog: (msg: string) => void;
}

type Mode = 'time' | 'count';

interface BenchmarkResult {
    settings: {
        mode: Mode;
        duration?: number;
        count?: number;
        poly_size: number;
        top_k: number;
    };
    summary: {
        total_generated: number;
        mean_heur_cost: number;
        median_heur_cost: number;
        max_heur_cost: number;
        worst_cases_verified: number;
    };
    score_distribution: Record<number, number>;
    all_heur_costs: number[];
    worst_cases: Array<{
        rank: number;
        polyomino: Coordinate[];
        heur_cost: number;
        exact_cost: number;
        ratio: number;
    }>;
    timestamp: string;
}

function downloadJSON(data: BenchmarkResult, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function AdversarialPanel({ onInstancesFound, addLog }: AdversarialPanelProps) {
    const [mode, setMode] = useState<Mode>('time');

    // Time-based settings
    const [duration, setDuration] = useState<number>(10);

    // Count-based settings
    const [count, setCount] = useState<number>(500);

    // Shared settings
    const [polySize, setPolySize] = useState<number>(12);
    const [topK, setTopK] = useState<number>(8);

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setBenchmarkResult(null);

        const label = mode === 'time' ? `${duration}s time limit` : `${count.toLocaleString()} instances`;
        addLog(`Starting adversarial ${mode === 'time' ? 'search' : 'benchmark'} (${label}, size ${polySize})...`);

        try {
            const body: Record<string, any> = { mode, max_size: polySize, top_k: topK };
            if (mode === 'time') body.duration = duration;
            else body.count = count;

            const res = await fetch('/api/adversarial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate adversarial instances');
            }

            const data = await res.json();
            const instances: any[] = data.instances ?? [];
            const summary = data.summary ?? { total_generated: 0 };

            addLog(
                `Done. ${summary.total_generated.toLocaleString()} generated → ` +
                `${instances.length} verified. Max BU-SPH cost: ${summary.max_heur_cost}, ` +
                `mean: ${summary.mean_heur_cost}`
            );

            // Build the downloadable result object
            const result: BenchmarkResult = {
                timestamp: new Date().toISOString(),
                settings: {
                    mode,
                    ...(mode === 'time' ? { duration } : { count }),
                    poly_size: polySize,
                    top_k: topK,
                },
                summary,
                score_distribution: data.score_distribution ?? {},
                all_heur_costs: data.all_heur_costs ?? [],
                worst_cases: instances.map((inst: any, idx: number) => ({
                    rank: idx + 1,
                    polyomino: inst.polyomino,
                    heur_cost: inst.heurCost,
                    exact_cost: inst.exactCost,
                    ratio: inst.ratio,
                })),
            };
            setBenchmarkResult(result);

            if (instances.length === 0) {
                addLog('No hard instances found — try a larger polyomino size or more iterations.');
                return;
            }

            const newPresets: Preset[] = instances.slice(0, 10).map((inst: any, idx: number) => ({
                id: `adversarial-${Date.now()}-${idx}`,
                name: `Worst-Case #${idx + 1}  (×${inst.ratio.toFixed(2)})`,
                description: `BU-SPH: ${inst.heurCost}  |  Optimal: ${inst.exactCost}  |  Size: ${inst.polyomino.length}`,
                coordinates: inst.polyomino as Coordinate[],
            }));

            onInstancesFound(newPresets, summary.total_generated);
        } catch (err: any) {
            setError(err.message);
            addLog(`Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!benchmarkResult) return;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        downloadJSON(benchmarkResult, `1msta-benchmark-${ts}.json`);
    };

    return (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 shadow-sm space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-700/50 pb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-200">Adversarial Generator</h3>
                    <p className="text-xs text-slate-400">Find where BU-SPH fails vs. CP-SAT Optimal</p>
                </div>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm font-medium">
                <button
                    onClick={() => setMode('time')}
                    disabled={isGenerating}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors border-r border-slate-700 ${mode === 'time'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Timer className="w-3.5 h-3.5" />
                    Time Limit
                </button>
                <button
                    onClick={() => setMode('count')}
                    disabled={isGenerating}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${mode === 'count'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Hash className="w-3.5 h-3.5" />
                    Benchmark
                </button>
            </div>

            <div className="space-y-4">
                {/* Time-based controls */}
                {mode === 'time' && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-sm text-slate-400">Search Duration</label>
                            <span className="text-sm font-medium text-orange-300">{duration}s</span>
                        </div>
                        <input
                            type="range" min="2" max="120" step="1"
                            value={duration}
                            onChange={e => setDuration(Number(e.target.value))}
                            className="w-full accent-orange-500"
                            disabled={isGenerating}
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                            <span>2s</span><span>120s</span>
                        </div>
                    </div>
                )}

                {/* Count-based controls */}
                {mode === 'count' && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-sm text-slate-400">Instances to Generate</label>
                            <span className="text-sm font-medium text-orange-300">{count.toLocaleString()}</span>
                        </div>
                        <input
                            type="range" min="50" max="200000" step="500"
                            value={count}
                            onChange={e => setCount(Number(e.target.value))}
                            className="w-full accent-orange-500"
                            disabled={isGenerating}
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                            <span>50</span><span>200 000</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            Scores all {count.toLocaleString()} shapes with BU-SPH, then verifies top-K with CP-SAT.
                        </p>
                    </div>
                )}

                {/* Shared: Polyomino size */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-slate-400">Polyomino Size (pixels)</label>
                        <span className="text-sm font-medium text-slate-300">{polySize}</span>
                    </div>
                    <input
                        type="range" min="5" max="200" step="1"
                        value={polySize}
                        onChange={e => setPolySize(Number(e.target.value))}
                        className="w-full accent-orange-500"
                        disabled={isGenerating}
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>5</span><span>200</span>
                    </div>
                </div>

                {/* Shared: Top K */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-slate-400">CP-SAT Verification Count (Top K)</label>
                        <span className="text-sm font-medium text-slate-300">{topK}</span>
                    </div>
                    <input
                        type="range" min="1" max="2000" step="10"
                        value={topK}
                        onChange={e => setTopK(Number(e.target.value))}
                        className="w-full accent-orange-500"
                        disabled={isGenerating}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                        Higher = more accurate worst-cases, but slower (each runs CP-SAT).
                    </p>
                </div>

                {/* Result summary + download */}
                {benchmarkResult && !isGenerating && (
                    <div className="rounded-lg border border-slate-700 overflow-hidden">
                        {/* Stats */}
                        <div className="p-3 bg-slate-800/70 space-y-1 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Generated</span>
                                <span className="text-slate-200 font-medium">
                                    {benchmarkResult.summary.total_generated.toLocaleString()} shapes
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Worst cases (CP-SAT)</span>
                                <span className="text-orange-300 font-medium">
                                    {benchmarkResult.summary.worst_cases_verified}
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>BU-SPH cost — mean / max</span>
                                <span className="text-slate-300 font-mono">
                                    {benchmarkResult.summary.mean_heur_cost} / {benchmarkResult.summary.max_heur_cost}
                                </span>
                            </div>
                            {benchmarkResult.worst_cases.length > 0 && (
                                <div className="flex justify-between text-slate-400">
                                    <span>Best ratio found</span>
                                    <span className="text-red-400 font-mono font-medium">
                                        ×{benchmarkResult.worst_cases[0].ratio.toFixed(3)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Top-10 worst case table */}
                        {benchmarkResult.worst_cases.length > 0 && (
                            <div className="border-t border-slate-700">
                                <div className="px-3 py-2 bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                    Top {Math.min(10, benchmarkResult.worst_cases.length)} Worst Cases
                                </div>
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-slate-700/50">
                                            <th className="px-3 py-1 text-left font-normal">#</th>
                                            <th className="px-3 py-1 text-right font-normal">BU-SPH</th>
                                            <th className="px-3 py-1 text-right font-normal">Opt</th>
                                            <th className="px-3 py-1 text-right font-normal">Ratio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {benchmarkResult.worst_cases.slice(0, 10).map((wc) => (
                                            <tr key={wc.rank} className="border-b border-slate-700/30 text-slate-300">
                                                <td className="px-3 py-1 text-slate-500">{wc.rank}</td>
                                                <td className="px-3 py-1 text-right text-slate-300">{wc.heur_cost}</td>
                                                <td className="px-3 py-1 text-right text-slate-400">{wc.exact_cost}</td>
                                                <td className="px-3 py-1 text-right text-orange-300 font-mono font-medium">
                                                    ×{wc.ratio.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Download button */}
                        <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border-t border-slate-700 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            Download Full Results (JSON)
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:text-orange-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{mode === 'time' ? 'Searching...' : 'Running Benchmark...'}</span>
                        </>
                    ) : (
                        <>
                            <Cpu className="w-4 h-4" />
                            <span>{mode === 'time' ? 'Find Worst Cases' : 'Run Benchmark'}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
