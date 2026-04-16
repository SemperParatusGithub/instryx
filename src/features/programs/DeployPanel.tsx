import { useState, useEffect, useCallback } from 'react'
import { generateKeyPairSigner, createKeyPairSignerFromBytes } from '@solana/kit'
import type { KeyPairSigner } from '@solana/kit'
import { toast } from 'sonner'
import { Copy, CheckCircle2, Loader2, AlertTriangle, Zap, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { deployProgram, estimateDeployLamports } from '@/lib/solana/deployProgram'
import { airdropAndConfirm } from '@/lib/solana/sendTransaction'
import { useNetworkStore } from '@/stores/networkStore'
import { useProgramStore } from '@/stores/programStore'
import type { StoredProgram } from '@/types'

const LAMPORTS_PER_SOL = 1_000_000_000n

function formatSol(lamports: bigint): string {
  const sol = Number(lamports) / Number(LAMPORTS_PER_SOL)
  return sol.toFixed(4) + ' SOL'
}

/** Parse a program keypair from a JSON array of bytes (Solana keypair.json format). */
async function parseKeypairJson(raw: string): Promise<KeyPairSigner> {
  let arr: unknown
  try {
    arr = JSON.parse(raw.trim())
  } catch {
    throw new Error('Invalid JSON — paste the contents of your keypair.json file')
  }
  if (!Array.isArray(arr) || arr.length < 32) {
    throw new Error('Expected a JSON array of at least 32 bytes')
  }
  return createKeyPairSignerFromBytes(new Uint8Array(arr as number[]))
}

interface DeployPanelProps {
  program: StoredProgram
}

export function DeployPanel({ program }: DeployPanelProps) {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { recordDeployment } = useProgramStore()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [estimatedLamports, setEstimatedLamports] = useState<bigint | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [deployKeypair, setDeployKeypair] = useState<KeyPairSigner | null>(null)
  const [copied, setCopied] = useState(false)
  const [airdropping, setAirdropping] = useState(false)

  // Program keypair — auto-loaded from stored keypair, or manually pasted
  const [programKeypairJson, setProgramKeypairJson] = useState('')
  const [programKeypairSigner, setProgramKeypairSigner] = useState<KeyPairSigner | null>(null)
  const [keypairError, setKeypairError] = useState<string | null>(null)

  // Auto-load from stored keypair when program changes
  useEffect(() => {
    setProgramKeypairSigner(null)
    if (!program.programKeypairBase64) return
    const binary = atob(program.programKeypairBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    createKeyPairSignerFromBytes(bytes)
      .then(setProgramKeypairSigner)
      .catch((e) => toast.error('Failed to load program keypair: ' + (e instanceof Error ? e.message : String(e))))
  }, [program.id, program.programKeypairBase64])

  const isLocalnet = network === 'localnet'
  const isDevnet = network === 'devnet'
  const existingDeployment = program.deployments[network]

  // Suggest declared address from IDL if available
  const declaredAddress = program.idl?.address

  // Warn when the loaded keypair's address doesn't match declare_id!() in the IDL.
  // This is the most common cause of DeclaredProgramIdMismatch — wrong keypair file.
  const keypairIdMismatch =
    programKeypairSigner && declaredAddress && programKeypairSigner.address !== declaredAddress

  useEffect(() => {
    if (!activeRpcUrl) return
    setEstimating(true)
    estimateDeployLamports(activeRpcUrl, program.elfSize)
      .then(setEstimatedLamports)
      .catch(() => setEstimatedLamports(null))
      .finally(() => setEstimating(false))
  }, [activeRpcUrl, program.elfSize])

  const handleKeypairJsonChange = async (raw: string) => {
    setProgramKeypairJson(raw)
    setKeypairError(null)
    setProgramKeypairSigner(null)
    if (!raw.trim()) return
    try {
      const kp = await parseKeypairJson(raw)
      setProgramKeypairSigner(kp)
    } catch (e) {
      setKeypairError(e instanceof Error ? e.message : String(e))
    }
  }

  const getElfBytes = useCallback((): Uint8Array => {
    const binary = atob(program.elfBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }, [program.elfBase64])

  const handleGenerateKeypair = async () => {
    const kp = await generateKeyPairSigner()
    setDeployKeypair(kp)
  }

  const handleCopyAddress = () => {
    if (!deployKeypair) return
    navigator.clipboard.writeText(deployKeypair.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleAirdrop = async () => {
    if (!deployKeypair || !estimatedLamports) return
    setAirdropping(true)
    try {
      const sol = Math.ceil(Number(estimatedLamports) / Number(LAMPORTS_PER_SOL)) + 1
      await airdropAndConfirm(activeRpcUrl, deployKeypair.address, sol)
      toast.success(`Airdropped ${sol} SOL to deploy keypair`)
    } catch (e) {
      toast.error('Airdrop failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAirdropping(false)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true)
    setProgress([])
    try {
      let payer: KeyPairSigner

      if (isLocalnet) {
        payer = await generateKeyPairSigner()
        const sol = estimatedLamports
          ? Math.ceil(Number(estimatedLamports) / Number(LAMPORTS_PER_SOL)) + 1
          : 10
        setProgress((p) => [...p, `Airdropping ${sol} SOL to temp payer…`])
        await airdropAndConfirm(activeRpcUrl, payer.address, sol)
      } else {
        if (!deployKeypair) {
          toast.error('Generate a deploy keypair first')
          setDeploying(false)
          return
        }
        payer = deployKeypair
      }

      const elfBytes = getElfBytes()
      const programAddress = await deployProgram(activeRpcUrl, payer, elfBytes, {
        onProgress: (msg) => setProgress((p) => [...p, msg]),
        programKeypair: programKeypairSigner ?? undefined,
      })

      recordDeployment(program.id, network, programAddress)
      toast.success(`Deployed at ${programAddress}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Deploy failed: ' + msg.slice(0, 120))
      setProgress((p) => [...p, `Error: ${msg}`])
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Re-deploy warning */}
      {existingDeployment && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="size-4 text-yellow-500" />
          <AlertDescription className="text-xs">
            <span className="font-medium">Re-deploying creates a new program address</span> — this
            is not an upgrade. The existing deployment at{' '}
            <span className="font-mono">{existingDeployment.programId.slice(0, 16)}…</span> will
            remain on-chain.
          </AlertDescription>
        </Alert>
      )}

      {/* Keypair/IDL address mismatch — wrong keypair file */}
      {keypairIdMismatch && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="size-4 text-red-500" />
          <AlertDescription className="text-xs">
            <span className="font-medium">Wrong keypair.</span> The keypair's public key is{' '}
            <span className="font-mono break-all">{programKeypairSigner!.address}</span> but the
            IDL declares{' '}
            <span className="font-mono break-all">{declaredAddress}</span>. Deploying with this
            keypair will still cause <code>DeclaredProgramIdMismatch</code>. Use the keypair from{' '}
            <code>target/deploy/&lt;name&gt;-keypair.json</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Declared program ID hint (only shown when keypair is correct or absent) */}
      {declaredAddress && !keypairIdMismatch && !programKeypairSigner && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <KeyRound className="size-4 text-blue-400" />
          <AlertDescription className="text-xs">
            <span className="font-medium">Anchor program detected.</span> To avoid{' '}
            <code className="text-xs">DeclaredProgramIdMismatch</code>, provide the keypair whose
            public key is{' '}
            <span className="font-mono break-all">{declaredAddress}</span>.
          </AlertDescription>
        </Alert>
      )}

      {/* Existing deployments */}
      {Object.entries(program.deployments).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Existing Deployments
          </p>
          <div className="space-y-1.5">
            {Object.entries(program.deployments).map(([net, dep]) => (
              <div key={net} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs">{net}</Badge>
                <span className="font-mono text-muted-foreground truncate">{dep.programId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Program keypair (optional) */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Program Keypair{' '}
          <span className="text-muted-foreground font-normal">(optional — required for Anchor)</span>
        </Label>
        {program.programKeypairBase64 && programKeypairSigner ? (
          <div className={`flex items-center gap-2 bg-muted rounded-md px-3 py-2 ${keypairIdMismatch ? 'border border-red-500/50' : ''}`}>
            <KeyRound className={`size-3.5 shrink-0 ${keypairIdMismatch ? 'text-red-500' : 'text-green-500'}`} />
            <span className={`text-xs font-mono truncate flex-1 ${keypairIdMismatch ? 'text-red-500' : 'text-green-500'}`}>
              {programKeypairSigner.address}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">from upload</span>
          </div>
        ) : (
          <>
            <Textarea
              value={programKeypairJson}
              onChange={(e) => handleKeypairJsonChange(e.target.value)}
              placeholder={'Paste keypair.json contents: [1,2,3,…]'}
              className="font-mono text-xs h-16 resize-none"
            />
            {keypairError && <p className="text-xs text-destructive">{keypairError}</p>}
            {programKeypairSigner && (
              <p className={`text-xs font-mono truncate ${keypairIdMismatch ? 'text-red-500' : 'text-green-500'}`}>
                {keypairIdMismatch ? '✗' : '✓'} {programKeypairSigner.address}
              </p>
            )}
          </>
        )}
      </div>

      {/* Cost estimate */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground text-xs">Estimated cost:</span>
        {estimating ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : estimatedLamports !== null ? (
          <Badge variant="secondary">{formatSol(estimatedLamports)}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Localnet: one-click */}
      {isLocalnet && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            A temporary fee-payer keypair is auto-airdropped. No wallet required.
          </p>
          <Button onClick={handleDeploy} disabled={deploying} className="w-full">
            {deploying ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Deploying…</>
            ) : (
              <><Zap className="size-4 mr-2" />Deploy to Localnet</>
            )}
          </Button>
        </div>
      )}

      {/* Devnet/mainnet: payer keypair flow */}
      {!isLocalnet && (
        <div className="space-y-3">
          {!deployKeypair ? (
            <Button variant="outline" onClick={handleGenerateKeypair} className="w-full">
              Generate Fee-Payer Keypair
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fee-Payer Address
              </p>
              <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <span className="font-mono text-xs truncate flex-1">{deployKeypair.address}</span>
                <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleCopyAddress}>
                  {copied ? <CheckCircle2 className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              {estimatedLamports !== null && (
                <p className="text-xs text-muted-foreground">
                  Fund this address with at least{' '}
                  <strong>{formatSol(estimatedLamports)}</strong> before deploying.
                </p>
              )}
              {isDevnet && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAirdrop}
                  disabled={airdropping}
                  className="w-full"
                >
                  {airdropping ? (
                    <><Loader2 className="size-3.5 animate-spin mr-1.5" />Airdropping…</>
                  ) : (
                    'Airdrop SOL to Fee-Payer'
                  )}
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={handleDeploy}
            disabled={deploying || !deployKeypair}
            className="w-full"
          >
            {deploying ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Deploying…</>
            ) : (
              <><Zap className="size-4 mr-2" />Deploy to {network}</>
            )}
          </Button>
        </div>
      )}

      {/* Progress log */}
      {progress.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Progress</p>
            <pre className="text-xs font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
              {progress.join('\n')}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
