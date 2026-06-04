import React, { useState } from 'react';
import { Cpu, AlertTriangle, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { Preset, Coordinate } from '../types';

interface AdversarialPanelProps {
    onInstancesFound: (instances: Preset[]) => void;
    addLog: (msg: string) => void;
}

export function AdversarialPanel({ onInstancesFound, addLog }: AdversarialPanelProps) {
    const [duration, setDuration] = useState<number>(5);
    const [maxSize, setMaxSize] = useState<number>(15);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        addLog(`Starting adversarial search for ${duration}s (max size ${maxSize})...`);

        try {
            const res = await fetch("/api/adversarial", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duration, max_size: maxSize })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to generate adversarial instances");
            }

            const data = await res.json();
            const instances = data.instances;

            if (!instances || instances.length === 0) {
                addLog("Adversarial search finished. No difficult instances found.");
                setIsGenerating(false);
                return;
            }

            addLog(`Adversarial search finished. Found ${instances.length} worst-cases.`);

            const newPresets: Preset[] = instances.map((inst: any, idx: number) => ({
                id: `adversarial-${idx}`,
                name: `Adversarial #${idx + 1} (Ratio: ${inst.ratio.toFixed(2)})`,
                description: `BU-SPH cost: ${inst.heurCost} | CP-SAT Opt: ${inst.exactCost}`,
                coordinates: inst.polyomino as Coordinate[]
            }));

            onInstancesFound(newPresets);
        } catch (err: any) {
            setError(err.message);
            addLog(`Adversarial Search Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-700/50 pb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-200">Adversarial Search</h3>
                    <p className="text-xs text-slate-400">Find where BU-SPH fails against CP-SAT</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">Search Duration (sec)</label>
                    <span className="text-sm font-medium text-slate-300 w-12 text-right">{duration}s</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="300"
                    step="1"
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={isGenerating}
                />

                <div className="flex items-center justify-between mt-4">
                    <label className="text-sm text-slate-400">Max Polyomino Size</label>
                    <span className="text-sm font-medium text-slate-300 w-12 text-right">{maxSize}</span>
                </div>
                <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={maxSize}
                    onChange={e => setMaxSize(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={isGenerating}
                />

                {error && (
                    <div className="p-3 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                            <span>Searching...</span>
                        </>
                    ) : (
                        <>
                            <Cpu className="w-4 h-4 text-orange-400" />
                            <span>Generate Worst Cases</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
