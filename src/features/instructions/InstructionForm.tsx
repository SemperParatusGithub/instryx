import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Loader2,
  Play,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Hash,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { anchorTypeLabel, anchorTypeInputType } from '@/lib/idl/formSchema'
import { buildAnchorInstruction } from '@/lib/solana/transactions'
import { buildAndSendTransaction, simulateInstructions } from '@/lib/solana/sendTransaction'
import { derivePda, type SeedEntry } from '@/lib/solana/pda'
import { useNetworkStore } from '@/stores/networkStore'
import { useIdlStore } from '@/stores/idlStore'
import { useWalletContext } from '@/features/wallet/useWalletContext'
import type { AnchorInstruction } from '@/types'

type SimResult = {
  err: unknown
  logs: readonly string[] | null
  unitsConsumed?: bigint | null
}

type TxResult = {
  signature: string
}

// ------------------------------------------------------------------
// PDA Deriver
// ------------------------------------------------------------------

function PdaDeriver({
  programId,
  onDerived,
}: {
  programId: string
  onDerived: (pda: string) => void
}) {
  const [seeds, setSeeds] = useState<SeedEntry[]>([{ type: 'string', value: '' }])
  const [result, setResult] = useState<{ pda: string; bump: number } | null>(null)
  const [deriving, setDeriving] = useState(false)
  const [copied, setCopied] = useState(false)

  const addSeed = () => setSeeds((s) => [...s, { type: 'string', value: '' }])
  const removeSeed = (i: number) => setSeeds((s) => s.filter((_, idx) => idx !== i))
  const updateSeed = (i: number, patch: Partial<SeedEntry>) =>
    setSeeds((s) => s.map((seed, idx) => (idx === i ? { ...seed, ...patch } : seed)))

  const derive = async () => {
    if (!programId) { toast.error('Program ID not set'); return }
    setDeriving(true)
    try {
      const res = await derivePda(programId, seeds)
      setResult(res)
    } catch (e) {
      toast.error('PDA derivation failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setDeriving(false)
    }
  }

  const copy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.pda).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="space-y-2 bg-muted/50 rounded-md p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Hash className="size-3.5" /> PDA Derivation
        </p>
        <Badge variant="secondary" className="text-xs font-normal">No wallet required</Badge>
      </div>
      {seeds.map((seed, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Select
            value={seed.type}
            onValueChange={(v) => updateSeed(i, { type: v as SeedEntry['type'] })}
          >
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="publicKey">pubkey</SelectItem>
              <SelectItem value="u8">u8</SelectItem>
              <SelectItem value="u64">u64</SelectItem>
              <SelectItem value="bytes">bytes</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={seed.value}
            onChange={(e) => updateSeed(i, { value: e.target.value })}
            placeholder={seed.type === 'bytes' ? '1,2,3 or 0x…' : seed.type}
            className="h-7 text-xs font-mono flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => removeSeed(i)}
            disabled={seeds.length === 1}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addSeed}>
          <Plus className="size-3 mr-1" /> Add Seed
        </Button>
        <Button size="sm" className="h-6 text-xs" onClick={derive} disabled={deriving}>
          {deriving ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
          Derive
        </Button>
        {result && (
          <>
            <span className="text-xs font-mono truncate text-green-500 flex-1">{result.pda}</span>
            <Badge variant="secondary" className="text-xs shrink-0">bump {result.bump}</Badge>
            <Button variant="ghost" size="icon" className="size-6" onClick={copy}>
              {copied ? <CheckCircle2 className="size-3 text-green-500" /> : <Copy className="size-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs shrink-0"
              onClick={() => onDerived(result.pda)}
            >
              Use
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Main InstructionForm
// ------------------------------------------------------------------

interface InstructionFormProps {
  instruction: AnchorInstruction
}

export function InstructionForm({ instruction }: InstructionFormProps) {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { getActiveIdl } = useIdlStore()
  const { signer, walletAddress, isConnected } = useWalletContext()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [expanded, setExpanded] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [sending, setSending] = useState(false)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [txResult, setTxResult] = useState<TxResult | null>(null)
  const [pdaTarget, setPdaTarget] = useState<string | null>(null)

  const { register, control, handleSubmit, setValue } = useForm<Record<string, unknown>>()

  // Collect instruction data from form values
  const buildInstruction = useCallback(
    async (formData: Record<string, unknown>) => {
      const idl = getActiveIdl()
      if (!idl) throw new Error('No IDL loaded')

      const args: Record<string, unknown> = {}
      for (const arg of instruction.args) {
        args[arg.name] = formData[`arg_${arg.name}`]
      }

      const accounts: Record<string, string> = {}
      for (const acc of instruction.accounts) {
        const val = acc.address ?? (formData[`acc_${acc.name}`] as string) ?? ''
        accounts[acc.name] = val
      }

      return buildAnchorInstruction({
        idl: idl.idl,
        instruction,
        args,
        accounts,
      })
    },
    [getActiveIdl, instruction],
  )

  const getFeePayer = useCallback(
    (formData: Record<string, unknown>) => {
      const explicit = formData['__feePayer'] as string
      return explicit?.trim() || walletAddress || ''
    },
    [walletAddress],
  )

  const onSimulate = useCallback(
    async (formData: Record<string, unknown>) => {
      const feePayer = getFeePayer(formData)
      if (!feePayer) { toast.error('Fee payer required (connect wallet or enter address)'); return }

      setSimulating(true)
      setSimResult(null)
      setTxResult(null)
      try {
        const ix = await buildInstruction(formData)
        const result = await simulateInstructions(activeRpcUrl, feePayer, [ix])
        setSimResult(result)
        if (result.err) {
          toast.error('Simulation failed')
        } else {
          toast.success('Simulation succeeded')
        }
      } catch (e) {
        toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
      } finally {
        setSimulating(false)
      }
    },
    [activeRpcUrl, buildInstruction, getFeePayer],
  )

  const onSend = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!signer) { toast.error('Connect a wallet to send transactions'); return }

      setSending(true)
      setTxResult(null)
      try {
        const ix = await buildInstruction(formData)
        const sig = await buildAndSendTransaction(activeRpcUrl, signer, [ix])
        setTxResult({ signature: sig })
        toast.success('Transaction sent!')
      } catch (e) {
        toast.error('Send failed: ' + (e instanceof Error ? e.message : String(e)))
      } finally {
        setSending(false)
      }
    },
    [activeRpcUrl, buildInstruction, signer],
  )

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-mono font-medium">{instruction.name}</CardTitle>
            <div className="flex gap-1">
              {instruction.args.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {instruction.args.length} args
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {instruction.accounts.length} accts
              </Badge>
            </div>
          </div>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
        {instruction.docs && instruction.docs.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{instruction.docs[0]}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Fee payer */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Fee Payer{walletAddress ? ' (auto-filled from wallet)' : ''}
            </Label>
            <Input
              {...register('__feePayer')}
              placeholder={walletAddress ?? 'Public key of fee payer…'}
              defaultValue={walletAddress ?? ''}
              className="font-mono text-xs"
            />
          </div>

          <Separator />

          {/* Accounts */}
          {instruction.accounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Accounts
              </p>
              {instruction.accounts.map((acc) => (
                <div key={acc.name} className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Label className="text-xs">{acc.name}</Label>
                    {acc.signer && <Badge className="text-xs py-0 px-1.5" variant="secondary">signer</Badge>}
                    {acc.writable && <Badge className="text-xs py-0 px-1.5" variant="outline">writable</Badge>}
                    {acc.optional && <Badge className="text-xs py-0 px-1.5" variant="outline">optional</Badge>}
                    {acc.pda && (
                      <button
                        type="button"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        onClick={() => setPdaTarget(pdaTarget === acc.name ? null : acc.name)}
                      >
                        {pdaTarget === acc.name ? 'hide PDA' : '+ derive PDA'}
                      </button>
                    )}
                  </div>
                  {acc.docs && acc.docs.length > 0 && (
                    <p className="text-xs text-muted-foreground">{acc.docs[0]}</p>
                  )}
                  {acc.address ? (
                    <Input value={acc.address} readOnly className="font-mono text-xs bg-muted" />
                  ) : (
                    <>
                      <Input
                        {...register(`acc_${acc.name}`)}
                        placeholder={
                          acc.signer && walletAddress
                            ? `${walletAddress.slice(0, 6)}… (wallet)`
                            : `${acc.name} public key…`
                        }
                        defaultValue={acc.signer && walletAddress ? walletAddress : ''}
                        className="font-mono text-xs"
                      />
                      {pdaTarget === acc.name && (
                        <PdaDeriver
                          programId={getActiveIdl()?.programId ?? ''}
                          onDerived={(pda) => {
                            setValue(`acc_${acc.name}`, pda)
                            setPdaTarget(null)
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Args */}
          {instruction.args.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Arguments
                </p>
                {instruction.args.map((arg) => {
                  const inputType = anchorTypeInputType(arg.type)
                  const typeLabel = anchorTypeLabel(arg.type)
                  return (
                    <div key={arg.name} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">{arg.name}</Label>
                        <span className="text-xs text-muted-foreground font-mono">{typeLabel}</span>
                      </div>
                      {inputType === 'checkbox' ? (
                        <Controller
                          name={`arg_${arg.name}`}
                          control={control}
                          defaultValue={false}
                          render={({ field }) => (
                            <Switch
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                      ) : (
                        <Input
                          {...register(`arg_${arg.name}`)}
                          type={inputType}
                          placeholder={typeLabel}
                          className="font-mono text-xs"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Simulation result */}
          {simResult && (
            <>
              <Separator />
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-2 text-sm font-medium ${
                    simResult.err ? 'text-destructive' : 'text-green-500'
                  }`}
                >
                  {simResult.err ? (
                    <AlertCircle className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {simResult.err ? 'Simulation failed' : 'Simulation passed'}
                  {simResult.unitsConsumed != null && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {simResult.unitsConsumed.toLocaleString()} CU
                    </Badge>
                  )}
                </div>
                {Boolean(simResult.err) && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs font-mono break-all">
                      {JSON.stringify(simResult.err, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) as string}
                    </AlertDescription>
                  </Alert>
                )}
                {simResult.logs && simResult.logs.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-medium">Program Logs</p>
                    <pre className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {simResult.logs.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tx result */}
          {txResult && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                  <CheckCircle2 className="size-4" />
                  Transaction confirmed
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground break-all">
                  {txResult.signature}
                  <Link
                    to={`/transactions?sig=${txResult.signature}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                  >
                    View transaction
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSubmit(onSimulate)}
              disabled={simulating}
            >
              {simulating ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <FlaskConical className="size-3.5 mr-1.5" />
              )}
              Simulate
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit(onSend)}
              disabled={sending || !isConnected}
              title={!isConnected ? 'Connect a wallet to send' : undefined}
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Play className="size-3.5 mr-1.5" />
              )}
              Send
              {!isConnected && <span className="ml-1 text-xs opacity-60">(no wallet)</span>}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
