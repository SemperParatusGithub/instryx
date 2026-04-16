import { useState, useCallback, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Loader2,
  Play,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  FileJson,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccountInput } from './AccountInput'
import { anchorTypeLabel, anchorTypeInputType } from '@/lib/idl/formSchema'
import { buildAnchorInstruction } from '@/lib/solana/transactions'
import { buildAndSendTransaction, simulateInstructions } from '@/lib/solana/sendTransaction'
import { parseAndValidateIdl } from '@/lib/idl/parseIdl'
import { useNetworkStore } from '@/stores/networkStore'
import { useProgramStore } from '@/stores/programStore'
import { useWalletContext } from '@/features/wallet/useWalletContext'
import type { StoredProgram, AnchorInstruction, AnchorIdl } from '@/types'

type SimResult = { err: unknown; logs: readonly string[] | null; unitsConsumed?: bigint | null }
type TxResult = { signature: string }

interface InvokePanelProps {
  program: StoredProgram
}

export function InvokePanel({ program }: InvokePanelProps) {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { attachIdl } = useProgramStore()
  const { signer, walletAddress, isConnected } = useWalletContext()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [selectedIx, setSelectedIx] = useState<AnchorInstruction | null>(
    program.idl?.instructions[0] ?? null,
  )
  const [simulating, setSimulating] = useState(false)
  const [sending, setSending] = useState(false)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [txResult, setTxResult] = useState<TxResult | null>(null)
  const [accountValues, setAccountValues] = useState<Record<string, string>>({})
  const idlInputRef = useRef<HTMLInputElement>(null)

  const { register, control, handleSubmit, setValue } = useForm<Record<string, unknown>>()

  // ---- IDL attach guard ----
  const handleAttachIdl = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const idl: AnchorIdl = parseAndValidateIdl(text)
      attachIdl(program.id, idl)
      toast.success('IDL attached')
    } catch (err) {
      toast.error('Invalid IDL: ' + (err instanceof Error ? err.message : String(err)))
    }
    if (idlInputRef.current) idlInputRef.current.value = ''
  }

  if (!program.idl) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <FileJson className="size-10 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No IDL attached</p>
          <p className="text-xs text-muted-foreground">
            Attach an Anchor IDL to invoke instructions
          </p>
        </div>
        <input
          ref={idlInputRef}
          type="file"
          accept=".json"
          onChange={handleAttachIdl}
          className="hidden"
        />
        <Button variant="outline" onClick={() => idlInputRef.current?.click()}>
          <FileJson className="size-4 mr-2" />
          Attach IDL
        </Button>
      </div>
    )
  }

  const idl = program.idl
  const deployment = program.deployments[network]

  // If a deployment exists but its address doesn't match the IDL's declared address,
  // the program was deployed before the keypair was provided.  Invoking it will always
  // fail with DeclaredProgramIdMismatch — the user must re-deploy with the keypair.
  const addressMismatch =
    deployment && idl.address && deployment.programId !== idl.address

  const effectiveIdl: AnchorIdl = deployment
    ? { ...idl, address: deployment.programId }
    : idl

  const buildIx = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!selectedIx) throw new Error('No instruction selected')

      const args: Record<string, unknown> = {}
      for (const arg of selectedIx.args) {
        args[arg.name] = formData[`arg_${arg.name}`]
      }

      const accounts: Record<string, string> = {}
      for (const acc of selectedIx.accounts) {
        const val = acc.address ?? accountValues[acc.name] ?? ''
        accounts[acc.name] = val
      }

      return buildAnchorInstruction({ idl: effectiveIdl, instruction: selectedIx, args, accounts })
    },
    [selectedIx, effectiveIdl, accountValues],
  )

  const getFeePayer = (formData: Record<string, unknown>) => {
    const explicit = formData['__feePayer'] as string
    return explicit?.trim() || walletAddress || ''
  }

  const onSimulate = async (formData: Record<string, unknown>) => {
    const feePayer = getFeePayer(formData)
    if (!feePayer) { toast.error('Fee payer required'); return }
    setSimulating(true)
    setSimResult(null)
    setTxResult(null)
    try {
      const ix = await buildIx(formData)
      const result = await simulateInstructions(activeRpcUrl, feePayer, [ix])
      setSimResult(result)
      result.err ? toast.error('Simulation failed') : toast.success('Simulation succeeded')
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSimulating(false)
    }
  }

  const onSend = async (formData: Record<string, unknown>) => {
    if (!signer) { toast.error('Connect a wallet to send transactions'); return }
    setSending(true)
    setTxResult(null)
    try {
      const ix = await buildIx(formData)
      const sig = await buildAndSendTransaction(activeRpcUrl, signer, [ix])
      setTxResult({ signature: sig })
      toast.success('Transaction sent!')
    } catch (e) {
      toast.error('Send failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Address mismatch warning — stale deployment before keypair was added */}
      {addressMismatch && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="size-4 text-red-500" />
          <AlertDescription className="text-xs">
            <span className="font-medium">Program ID mismatch.</span> The deployment on{' '}
            <span className="font-mono">{network}</span> is at{' '}
            <span className="font-mono">{deployment!.programId.slice(0, 16)}…</span> but the IDL
            declares{' '}
            <span className="font-mono">{idl.address.slice(0, 16)}…</span>. Go to the{' '}
            <span className="font-medium">Deploy</span> tab and re-deploy using the program keypair
            to fix this.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruction selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Instruction</Label>
        <Select
          value={selectedIx?.name ?? ''}
          onValueChange={(name) => {
            const ix = idl.instructions.find((i) => i.name === name) ?? null
            setSelectedIx(ix)
            setSimResult(null)
            setTxResult(null)
            setAccountValues({})
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select instruction…" />
          </SelectTrigger>
          <SelectContent>
            {idl.instructions.map((ix) => (
              <SelectItem key={ix.name} value={ix.name}>
                <span className="font-mono">{ix.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedIx && (
        <>
          {/* Fee payer */}
          <div className="space-y-1.5">
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
          {selectedIx.accounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Accounts
              </p>
              {selectedIx.accounts.map((acc) => (
                <div key={acc.name} className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Label className="text-xs">{acc.name}</Label>
                    {acc.signer && (
                      <Badge className="text-xs py-0 px-1.5" variant="secondary">signer</Badge>
                    )}
                    {acc.writable && (
                      <Badge className="text-xs py-0 px-1.5" variant="outline">writable</Badge>
                    )}
                    {acc.optional && (
                      <Badge className="text-xs py-0 px-1.5" variant="outline">optional</Badge>
                    )}
                  </div>
                  {acc.address ? (
                    <AccountInput
                      value={acc.address}
                      onChange={() => {}}
                      readOnly
                    />
                  ) : (
                    <AccountInput
                      value={accountValues[acc.name] ?? (acc.signer && walletAddress ? walletAddress : '')}
                      onChange={(v) => {
                        setAccountValues((prev) => ({ ...prev, [acc.name]: v }))
                        setValue(`acc_${acc.name}`, v)
                      }}
                      placeholder={
                        acc.signer && walletAddress
                          ? `${walletAddress.slice(0, 6)}… (wallet)`
                          : `${acc.name} public key…`
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Args */}
          {selectedIx.args.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Arguments
                </p>
                {selectedIx.args.map((arg) => {
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
        </>
      )}
    </div>
  )
}
