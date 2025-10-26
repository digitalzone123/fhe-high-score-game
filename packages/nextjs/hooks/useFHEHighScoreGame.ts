"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEHighScoreArena = (args: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = args;
  const { storage: decSigStore } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const activeChain = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: arenaContract } = useDeployedContractInfo({ contractName: "FHEHighScoreGame", chainId: activeChain });

  type ArenaContractInfo = Contract<"FHEHighScoreGame"> & { chainId?: number };

  const [statusMsg, setStatusMsg] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const hasContract = Boolean(arenaContract?.address && arenaContract?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getArenaContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const provOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!provOrSigner) return undefined;
    return new ethers.Contract(arenaContract!.address, (arenaContract as ArenaContractInfo).abi, provOrSigner);
  };

  const { data: historyData, refetch: refreshHistory } = useReadContract({
    address: hasContract ? (arenaContract!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((arenaContract as ArenaContractInfo).abi as any) : undefined,
    functionName: "getScoreHistory",
    args: [accounts ? accounts[0] : ""],
    query: { enabled: Boolean(hasContract && hasProvider), refetchOnWindowFocus: false },
  });

  // Decrypt history
  const historyDecryptRequests = useMemo(() => {
    if (!historyData || !Array.isArray(historyData)) return undefined;
    console.log(historyData.map(item => ({ handle: item, contractAddress: arenaContract!.address })));
    return historyData.map(item => ({ handle: item, contractAddress: arenaContract!.address }));
  }, [historyData, arenaContract?.address]);

  const {
    canDecrypt: canDecryptHistory,
    decrypt: decryptHistory,
    isDecrypting: isDecryptingHistory,
    message: historyDecMsg,
    results: historyResults,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: decSigStore,
    chainId,
    requests: historyDecryptRequests,
  });

  useEffect(() => {
    if (historyDecMsg) setStatusMsg(historyDecMsg);
  }, [historyDecMsg]);

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: arenaContract?.address,
  });

  const canSubmit = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isBusy),
    [hasContract, instance, hasSigner, isBusy],
  );

  const getEncryptionMethodFor = (fnName: "submitScore") => {
    const fnAbi = arenaContract?.abi.find(item => item.type === "function" && item.name === fnName);
    if (!fnAbi) return { method: undefined as string | undefined, error: `No ABI for ${fnName}` };
    if (!fnAbi.inputs || fnAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs for ${fnName}` };
    return { method: getEncryptionMethod(fnAbi.inputs[0].internalType), error: undefined };
  };

  const submitScore = useCallback(
    async (score: number) => {
      if (isBusy || !canSubmit) return;
      setIsBusy(true);
      setStatusMsg(`Submitting score (${score})...`);
      try {
        const { method, error } = getEncryptionMethodFor("submitScore");
        if (!method) return setStatusMsg(error ?? "Encryption method missing");
        setStatusMsg(`Encrypting with ${method}...`);
        const encData = await encryptWith(builder => {
          (builder as any)[method](score);
        });
        if (!encData) return setStatusMsg("Encryption failed");
        const contractWrite = getArenaContract("write");
        if (!contractWrite) return setStatusMsg("Contract unavailable or signer missing");
        const params = buildParamsFromAbi(encData, [...arenaContract!.abi] as any[], "submitScore");
        const tx = await contractWrite.submitScore(...params, { gasLimit: 300_000 });
        setStatusMsg("Waiting for transaction...");
        await tx.wait();
        setStatusMsg(`Score (${score}) submitted!`);
        await refreshHistory();
      } catch (e) {
        setStatusMsg(`submitScore() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, canSubmit, encryptWith, getArenaContract, refreshHistory, arenaContract?.abi],
  );

  useEffect(() => {
    setStatusMsg("");
  }, [accounts, chainId]);

  return {
    contractAddress: arenaContract?.address,
    canDecryptHistory,
    decryptHistory,
    isDecryptingHistory,
    historyResults,
    historyData,
    refreshHistory,
    submitScore,
    isProcessing: isBusy,
    canSubmit,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
    message: statusMsg,
  };
};
