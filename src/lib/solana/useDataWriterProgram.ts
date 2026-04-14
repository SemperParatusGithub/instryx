/**
 * Auto-deploys and caches the instryx-data-writer program.
 *
 * On localnet: fetches the bundled .so, deploys via BPF Upgradeable Loader,
 * caches the program ID in localStorage per RPC URL. Re-deploys automatically
 * if the cached program is gone (validator restarted).
 *
 * On other networks: returns null (caller must supply a program ID manually).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createSolanaRpc, generateKeyPairSigner, address } from '@solana/kit'
import { deployProgram, estimateDeployLamports } from './deployProgram'
import { airdropAndConfirm } from './sendTransaction'

// localStorage key prefix — scoped to RPC URL so localnet restarts get a fresh deploy
const CACHE_PREFIX = 'instryx-data-writer:'

function cacheKey(rpcUrl: string) {
  return CACHE_PREFIX + rpcUrl
}

/** Check whether a program account exists and is executable at the given address. */
async function programExists(rpcUrl: string, programId: string): Promise<boolean> {
  try {
    const rpc = createSolanaRpc(rpcUrl)
    // getAccountInfo returns null when the account does not exist
    const result = await rpc
      .getAccountInfo(address(programId), { encoding: 'base64' })
      .send()
    return result.value !== null && (result.value as { executable?: boolean }).executable === true
  } catch {
    return false
  }
}

export type DataWriterStatus =
  | 'idle'
  | 'checking'
  | 'deploying'
  | 'ready'
  | 'error'

export interface DataWriterState {
  programId: string | null
  status: DataWriterStatus
  progress: string
  error: string | null
  /** Manually trigger a (re-)deploy. */
  deploy: () => void
}

/**
 * Returns the instryx-data-writer program ID, deploying it if necessary.
 *
 * @param rpcUrl  Active RPC endpoint
 * @param isLocalnet  True when connected to localnet (auto-deploy enabled)
 */
export function useDataWriterProgram(rpcUrl: string, isLocalnet: boolean): DataWriterState {
  const [programId, setProgramId] = useState<string | null>(null)
  const [status, setStatus] = useState<DataWriterStatus>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const deployingRef = useRef(false)

  const doDeployOrRestore = useCallback(async () => {
    if (!isLocalnet) return
    if (deployingRef.current) return
    deployingRef.current = true

    setError(null)
    setStatus('checking')
    setProgress('Checking for existing deployment…')

    try {
      // 1. Check cache
      const cached = localStorage.getItem(cacheKey(rpcUrl))
      if (cached) {
        setProgress('Verifying cached program…')
        const alive = await programExists(rpcUrl, cached)
        if (alive) {
          setProgramId(cached)
          setStatus('ready')
          setProgress('')
          return
        }
        // Cached but gone (validator restarted) — fall through to deploy
        localStorage.removeItem(cacheKey(rpcUrl))
      }

      // 2. Fetch bundled binary
      setStatus('deploying')
      setProgress('Loading program binary…')
      const resp = await fetch('/instryx_data_writer.so')
      if (!resp.ok) throw new Error(`Failed to fetch binary: ${resp.status}`)
      const elfBytes = new Uint8Array(await resp.arrayBuffer())

      // 3. Calculate required SOL and airdrop
      setProgress('Requesting airdrop for deployment fees…')
      const neededLamports = await estimateDeployLamports(rpcUrl, elfBytes.length)
      const neededSol = Number(neededLamports) / 1_000_000_000 + 0.05  // +0.05 buffer

      const payer = await generateKeyPairSigner()
      await airdropAndConfirm(rpcUrl, payer.address, neededSol)

      // 4. Deploy
      const deployed = await deployProgram(rpcUrl, payer, elfBytes, {
        onProgress: (msg) => setProgress(msg),
      })

      // 5. Cache and return
      localStorage.setItem(cacheKey(rpcUrl), deployed)
      setProgramId(deployed)
      setStatus('ready')
      setProgress('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setStatus('error')
      setProgress('')
    } finally {
      deployingRef.current = false
    }
  }, [isLocalnet, rpcUrl])

  // Auto-run when the hook mounts or the RPC URL changes
  useEffect(() => {
    if (!isLocalnet) {
      setStatus('idle')
      setProgramId(null)
      return
    }
    doDeployOrRestore()
  }, [isLocalnet, rpcUrl, doDeployOrRestore])

  return { programId, status, progress, error, deploy: doDeployOrRestore }
}
