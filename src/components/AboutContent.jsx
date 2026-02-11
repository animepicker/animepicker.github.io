export default function AboutContent() {
    return (
        <div className="text-center">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-indigo-400 mb-4 tracking-tight">
                ANIME PICKER
            </h2>
            <p className="text-violet-200/60 text-base font-light mb-8">
                Manage your library and build your watchlist to uncover your next obsession.
            </p>

            <div className="pt-6 border-t border-white/5 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/10">
                    <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">POWERED BY</span>
                    <span className="text-[10px] text-blue-400 font-black tracking-widest uppercase">OPENROUTER & AI MODELS</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">VIBECODDED WITH</span>
                    <span className="text-[10px] text-violet-400 font-black tracking-widest uppercase">GOOGLE ANTIGRAVITY</span>
                </div>
                <div className="text-[9px] text-gray-600 font-mono tracking-tighter">
                    v2026.02.11.0821
                </div>
            </div>
        </div>
    );
}
