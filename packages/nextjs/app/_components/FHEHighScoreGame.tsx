"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEHighScoreArena } from "~~/hooks/useFHEHighScoreGame";

export const FHEHighScoreGameUI = () => {
  const { isConnected, chain } = useAccount();
  const activeChain = chain?.id;

  const ethProvider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const demoChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: scoreVM } = useFhevm({
    provider: ethProvider,
    chainId: activeChain,
    initialMockChains: demoChains,
    enabled: true,
  });

  const arena = useFHEHighScoreArena({ instance: scoreVM, initialMockChains: demoChains });

  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);

  // Cập nhật Best Score mỗi khi historyResults thay đổi
  useEffect(() => {
    if (arena.historyResults) {
      const scores = Object.values(arena.historyResults)
        .map(Number)
        .filter(v => !isNaN(v));
      setBestScore(scores.length > 0 ? Math.max(...scores) : null);
    }
  }, [arena.historyResults]);

  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-100px)] w-full flex items-center justify-center text-white">
        <motion.div
          className="h-[350px] w-[500px] bg-black/40 border border-cyan-400 rounded-2xl p-12 text-center shadow-xl backdrop-blur-md"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="text-7xl mb-5 animate-pulse">🏆</div>
          <h2 className="text-4xl font-extrabold mb-3 tracking-wide">Connect Wallet</h2>
          <p className="text-gray-300 mb-6">Access the FHE Score Arena</p>
          <RainbowKitCustomConnectButton />
        </motion.div>
      </div>
    );
  }

  const submitCurrentScore = async () => {
    if (!currentScore || !arena.canSubmit || arena.isProcessing) return;
    await arena.submitScore(currentScore);
    setCurrentScore(null);
  };

  const revealHistory = async () => {
    if (!arena.canDecryptHistory || arena.isDecryptingHistory) return;
    await arena.decryptHistory();
  };

  return (
    <div className="h-[calc(100vh-52px)] w-full flex items-center p-8 text-gray-100">
      <motion.div className="w-3xl mx-auto flex flex-col gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div
          className="bg-black/30 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-cyan-500"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-3xl font-bold mb-4 text-cyan-400 tracking-wide">🏆 Score Arena</h1>
          <p className="text-gray-300 mb-6">Submit your score and challenge your best!</p>

          <div className="flex gap-3 mb-6">
            <input
              type="number"
              min={0}
              value={currentScore ?? ""}
              onChange={e => setCurrentScore(Number(e.target.value))}
              className="flex-1 rounded-lg px-4 py-2 font-semibold text-white outline-none ring-2 ring-cyan-400 no-spin"
              placeholder="Enter score"
            />
            <button
              onClick={submitCurrentScore}
              disabled={!arena.canSubmit || arena.isProcessing || currentScore === null}
              className={`px-6 py-2 rounded-lg font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition ${
                !arena.canSubmit || arena.isProcessing || currentScore === null ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              Submit
            </button>
          </div>

          <div className="mb-6 flex items-center justify-between bg-black/20 p-3 rounded-lg border border-pink-400">
            <div className="flex-1">
              <h3 className="font-bold text-pink-400 mb-1 tracking-wide">🏅 Best Score</h3>
              <p className="text-gray-200 font-mono flex items-center">
                {bestScore !== null ? bestScore : "🔒 Encrypted / Unknown"}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-pink-300 mb-2">
            🧾 Score Timeline ({arena.historyData?.length ?? 0} {arena.historyData?.length === 1 ? "play" : "plays"})
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {arena.historyData && arena.historyData.length > 0 ? (
              arena.historyData.map((entry, index) => {
                const revealed = Number(arena.historyResults?.[entry]);
                return (
                  <motion.div
                    key={index}
                    className="flex items-center gap-4 bg-black/20 p-3 rounded-lg border-l-4 border-cyan-400 hover:border-pink-400 transition"
                  >
                    <div className="w-6 h-6 flex items-center justify-center text-pink-400 font-bold">{index + 1}</div>
                    <div className="flex-1 font-mono text-yellow-400">
                      {Number.isNaN(revealed) ? "🔒 Encrypted" : revealed}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-gray-400 italic">No scores yet — submit your first score!</p>
            )}
          </div>

          <button
            onClick={revealHistory}
            disabled={!arena.canDecryptHistory || arena.isDecryptingHistory || arena.historyData?.length === 0}
            className={`mt-4 w-full px-4 py-3 rounded-lg bg-pink-500 text-black font-bold hover:bg-pink-400 transition ${
              arena.isDecryptingHistory || arena.historyData?.length === 0 ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            🔓 {arena.isDecryptingHistory ? "Decrypting..." : "Decrypt All Scores"}
          </button>

          {arena.message && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 bg-black/40 backdrop-blur-md border border-pink-400 rounded-xl p-4 text-pink-300"
            >
              {arena.message}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};
