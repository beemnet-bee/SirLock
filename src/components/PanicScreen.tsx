import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Code, Terminal, Layers, Play, Settings, Cpu, ChevronRight, ShieldCheck, Lock } from 'lucide-react';

interface PanicScreenProps {
  onDeactivatePanic: () => void;
}

export default function PanicScreen({ onDeactivatePanic }: PanicScreenProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'api' | 'perf'>('docs');

  return (
    <div id="decoy-container" className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-sans antialiased flex flex-col text-left selection:bg-blue-500 selection:text-white">
      {/* Top Decoy Navigation Bar */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Layers className="text-blue-500" size={20} />
          <span className="font-bold font-sans text-white text-sm tracking-tight">AtomicsCSS Core Developer Suite</span>
          <span className="bg-[#21262d] text-blue-400 border border-[#30363d] text-[10px] font-mono font-medium px-2 py-0.5 rounded-full">
            v2.4.1-stable
          </span>
        </div>

        <nav className="flex items-center gap-6 text-xs font-medium text-[#8b949e]">
          <span className="hover:text-white cursor-pointer transition-colors">Framework Specs</span>
          <span className="hover:text-white cursor-pointer transition-colors">Component Library</span>
          <span className="hover:text-white cursor-pointer transition-colors">Registry</span>
          <span className="text-white border-b-2 border-blue-500 pb-1 cursor-default">Developer Portal</span>
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#8b949e] hidden sm:block">Cluster Node: EU-WEST-2</span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Node Online" />
        </div>
      </header>

      {/* Main Grid Portal */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 px-6 py-8">
        
        {/* Left Drawer sidebar */}
        <aside className="md:col-span-3 flex flex-col gap-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase text-[#8b949e] tracking-wider mb-4">Documentation Index</h3>
            <div className="flex flex-col gap-1 text-xs">
              {[
                { label: 'Introduction & Core Init', icon: BookOpen },
                { label: 'Atomic Configuration Objects', icon: Settings },
                { label: 'Server Side Assembly', icon: Cpu },
                { label: 'Vite & Webpack Transpiler', icon: Terminal },
                { label: 'Dynamic Class Extraction', icon: Code },
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer transition-all ${
                    idx === 0 
                      ? 'bg-[#1f242c] text-white font-medium border-l-2 border-blue-500' 
                      : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
                  }`}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-white">Direct Production Build</h4>
            <p className="text-[11px] text-[#8b949e] leading-relaxed">Runs Atomic CSS optimization compiling down raw selectors into efficient style models.</p>
            <button className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
              <Play size={12} />
              <span>Compile Core Spec</span>
            </button>
          </div>
        </aside>

        {/* Center/Right documentation layout content */}
        <main className="md:col-span-9 flex flex-col gap-6">
          
          {/* Docs tabs */}
          <div className="flex border-b border-[#30363d] text-xs font-medium gap-6">
            <button 
              onClick={() => setActiveTab('docs')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'docs' ? 'border-blue-500 text-white' : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Getting Started
            </button>
            <button 
              onClick={() => setActiveTab('api')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'api' ? 'border-blue-500 text-white' : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              API Reference Parameters
            </button>
            <button 
              onClick={() => setActiveTab('perf')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'perf' ? 'border-blue-500 text-white' : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Performance Budgets
            </button>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-6">
            {activeTab === 'docs' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-white font-sans">Bootstrapping with AtomicsCSS core compiler</h2>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  Integrating our optimized layout parser into your Node.js or vite pipeline is instantaneous. Specify your extraction criteria inside your root configuration manifest and register our vite module to filter compiled layouts dynamically.
                </p>

                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs font-mono text-zinc-400">Initialize package configuration:</span>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 font-mono text-xs text-[#58a6ff] overflow-x-auto relative group">
                    <span className="absolute top-2 right-2 text-[9px] text-[#8b949e] select-none">BASH</span>
                    <code>npm i @atomicscss/core @atomicscss/vite-plugin</code>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs font-mono text-zinc-400">Include within your build config manifest:</span>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 font-mono text-xs text-[#e1e4e8] overflow-x-auto leading-relaxed relative">
                    <span className="absolute top-2 right-2 text-[9px] text-[#8b949e] select-none">TS</span>
                    <p className="text-[#f9758b]">import <span className="text-[#e1e4e8]">atomicscss</span> from <span className="text-[#9ecbff]">'@atomicscss/core'</span>;</p>
                    <p className="text-[#58a6ff]">// Core options definition</p>
                    <p className="text-[#f9758b]">{"export default defineConfig({"}</p>
                    <p className="text-[#e1e4e8]">{"  plugins: ["}</p>
                    <p className="text-[#9ecbff]">{"    atomicscss({"}</p>
                    <p className="text-[#9ecbff]">{"      watchDirs: [\"./src\", \"./components\"],"}</p>
                    <p className="text-[#9ecbff]">{"      outputCompress: true,"}</p>
                    <p className="text-[#9ecbff]">{"      shredLogs: false"}</p>
                    <p className="text-[#9ecbff]">{"    })"}</p>
                    <p className="text-[#e1e4e8]">{"  ]"}</p>
                    <p className="text-[#e1e4e8]">{"});"}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-white">Full-Stack Core Node API</h2>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  Utilize server-side processing nodes to analyze class layout components before static files are deployed. Outlines available methods:
                </p>

                <div className="divide-y divide-[#30363d] border-t border-b border-[#30363d]">
                  <div className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-mono text-blue-400">compileSpecFile(path: string)</span>
                    <span className="text-[#8b949e]">Promise&lt;StyleBuffer&gt;</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-mono text-blue-400">purgeUnusedSelectors(buffer: ArrayBuffer)</span>
                    <span className="text-[#8b949e]">ArrayBuffer</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-mono text-blue-400">getTelemetryDiagnostics()</span>
                    <span className="text-[#8b949e]">SystemMetricsReport</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'perf' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-white">Performance Budgets</h2>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  We enforce sub-millisecond compile loops during active developer configurations. Review standard footprint charts:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl text-center">
                    <span className="text-sky-400 font-bold text-2xl">0.08ms</span>
                    <p className="text-[10px] text-[#8b949e] uppercase mt-1">Average Parsing Speed</p>
                  </div>
                  <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl text-center">
                    <span className="text-emerald-400 font-bold text-2xl">&lt; 15KB</span>
                    <p className="text-[10px] text-[#8b949e] uppercase mt-1">Bundle Header Footprint</p>
                  </div>
                  <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl text-center">
                    <span className="text-purple-400 font-bold text-2xl">99.8%</span>
                    <p className="text-[10px] text-[#8b949e] uppercase mt-1">Compression Ratio</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

      </div>

      {/* Decoy Footer with Subtle Vault Access Door */}
      <footer className="border-t border-[#30363d] bg-[#161b22] py-6 px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#8b949e]">
        <div>
          <span>© 2026 AtomicsCSS Open Source Initiative Contributors. MIT License.</span>
        </div>

        <div className="flex items-center gap-6">
          <span className="hover:text-white cursor-pointer select-none">System Telemetry Check</span>
          <span className="hover:text-white cursor-pointer select-none">GitHub Mirror</span>
          
          {/* Subtle Secret Lock Icon to Return to Vault */}
          <button
            onClick={onDeactivatePanic}
            id="decoy-return-door"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-[#21262d] transition-all cursor-pointer font-mono text-[10px] text-zinc-600 border border-transparent hover:border-zinc-800"
          >
            <Lock size={11} className="text-zinc-600 group-hover:text-zinc-300" />
            <span>Vault Restore Node</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
