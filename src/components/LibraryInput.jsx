import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function LibraryInput({ onAdd }) {
    const [input, setInput] = useState('');

    const handleAddEntry = () => {
        const trimmed = input.trim();
        if (trimmed) {
            onAdd(trimmed);
            setInput('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddEntry();
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl">
                {/* Input Row */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add an anime to your library (e.g., Attack on Titan)"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                    <button
                        onClick={handleAddEntry}
                        disabled={!input.trim()}
                        className={`px-4 py-3 rounded-xl font-medium transition-all ${input.trim()
                            ? 'bg-violet-600 text-white hover:bg-violet-500'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <Plus size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
}
