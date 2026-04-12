import { useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Play, FlaskConical, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { anchorTypeLabel, anchorTypeInputType } from '@/lib/idl/formSchema'
import { buildAnchorInstruction, simulateTransaction } from '@/lib/solana/transactions'
import { useNetworkStore } from '@/stores/networkStore'
import { useIdlStore } from '@/stores/idlStore'
import type { AnchorInstruction } from '@/types'

interface SimResult {
  err: unknown
  logs: readonly string[] | null
  unitsConsumed?: bigint | null
}

interface InstructionFormProps {
  instruction: AnchorInstruction
}

export function InstructionForm({ instruction }: InstructionFormProps) {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { getActiveIdl } = useIdlStore()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [expanded, setExpanded] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<SimResult | null>(null)

  const { register, control, handleSubmit } = useForm<Record<string, unknown>>()

  const onSimulate = useCallback(
    async (formData: Record<string, unknown>) => {
      const idl = getActiveIdl()
      if (!idl) return

      const feePayer = (formData['__feePayer'] as string) || ''
      if (!feePayer) {
        toast.error('Fee payer address is required')
        return
      }

      const args: Record<string, unknown> = {}
      for (const arg of instruction.args) {
        args[arg.name] = formData[`arg_${arg.name}`]
      }

      const accounts: Record<string, string> = {}
      for (const acc of instruction.accounts) {
        accounts[acc.name] = (formData[`acc_${acc.name}`] as string) || ''
      }

      setSimulating(true)
      setSimResult(null)
      try {
        const { programId, keys, data } = await buildAnchorInstruction({
          idl: idl.idl,
          instruction,
          args,
          accounts,
          feePayer,
        })

        const result = await simulateTransaction(
          activeRpcUrl,
          feePayer,
          programId,
          keys,
          data,
        )
        setSimResult(result as SimResult)
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
    [activeRpcUrl, getActiveIdl, instruction],
  )

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
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
                {instruction.accounts.length} accounts
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
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit(onSimulate)} className="space-y-4">
            {/* Fee payer */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fee Payer</Label>
              <Input
                {...register('__feePayer')}
                placeholder="Public key of fee payer…"
                className="font-mono text-xs"
              />
            </div>

            {/* Accounts */}
            {instruction.accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Accounts
                </p>
                {instruction.accounts.map((acc) => (
                  <div key={acc.name} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">{acc.name}</Label>
                      {acc.signer && <Badge className="text-xs py-0 px-1" variant="secondary">signer</Badge>}
                      {acc.writable && <Badge className="text-xs py-0 px-1" variant="outline">writable</Badge>}
                      {acc.optional && <Badge className="text-xs py-0 px-1" variant="outline">optional</Badge>}
                    </div>
                    {acc.docs && acc.docs.length > 0 && (
                      <p className="text-xs text-muted-foreground">{acc.docs[0]}</p>
                    )}
                    {acc.address ? (
                      <Input
                        value={acc.address}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                    ) : (
                      <Input
                        {...register(`acc_${acc.name}`)}
                        placeholder={`${acc.name} public key…`}
                        className="font-mono text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Args */}
            {instruction.args.length > 0 && (
              <div className="space-y-2">
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
                        <span className="text-xs text-muted-foreground font-mono">
                          {typeLabel}
                        </span>
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
            )}

            {/* Simulate result */}
            {simResult && (
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-2 text-sm ${
                    simResult.err ? 'text-destructive' : 'text-green-500'
                  }`}
                >
                  <AlertCircle className="size-4" />
                  {simResult.err ? 'Simulation failed' : 'Simulation succeeded'}
                  {simResult.unitsConsumed != null && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {simResult.unitsConsumed.toLocaleString()} CU
                    </Badge>
                  )}
                </div>

                {Boolean(simResult.err) && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs font-mono">
                      {JSON.stringify(simResult.err, null, 2) as string}
                    </AlertDescription>
                  </Alert>
                )}

                {simResult.logs && simResult.logs.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Program Logs</p>
                    <pre className="text-xs font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {simResult.logs.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="outline"
                size="sm"
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
                disabled
                title="Connect a wallet to send transactions"
              >
                <Play className="size-3.5 mr-1.5" />
                Send
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
