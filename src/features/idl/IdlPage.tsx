import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  FileJson,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIdlStore } from '@/stores/idlStore'
import { parseAndValidateIdl, idlToStoredIdl } from '@/lib/idl/parseIdl'
import type {
  StoredIdl,
  AnchorType,
  AnchorInstruction,
  AnchorTypeDef,
  AnchorEventDef,
} from '@/types'

// ---- Helpers ----------------------------------------------------------------

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function typeToString(t: AnchorType): string {
  if (typeof t === 'string') return t
  if ('vec' in t) return `Vec<${typeToString(t.vec)}>`
  if ('option' in t) return `Option<${typeToString(t.option)}>`
  if ('array' in t) return `[${typeToString(t.array[0])}; ${t.array[1]}]`
  if ('defined' in t) return t.defined.name
  return JSON.stringify(t)
}

function DiscriminatorBadge({ bytes }: { bytes: number[] }) {
  return (
    <span className="font-mono text-xs text-muted-foreground">
      [{bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]
    </span>
  )
}

// ---- Collapsible row --------------------------------------------------------

function CollapsibleRow({
  label,
  badge,
  children,
}: {
  label: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border bg-muted/20">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-md"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 font-mono text-xs font-medium">{label}</span>
        {badge}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t space-y-2 text-xs">
          {children}
        </div>
      )}
    </div>
  )
}

// ---- Instruction detail -----------------------------------------------------

function InstructionDetail({ ix }: { ix: AnchorInstruction }) {
  return (
    <CollapsibleRow
      label={ix.name}
      badge={
        <div className="flex gap-1 shrink-0">
          {ix.args.length > 0 && (
            <Badge variant="outline" className="text-xs py-0">{ix.args.length} args</Badge>
          )}
          <Badge variant="outline" className="text-xs py-0">{ix.accounts.length} accts</Badge>
        </div>
      }
    >
      {/* Docs */}
      {ix.docs && ix.docs.length > 0 && (
        <p className="text-muted-foreground italic">{ix.docs.join(' ')}</p>
      )}

      {/* Discriminator */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0">Discriminator</span>
        <DiscriminatorBadge bytes={ix.discriminator} />
      </div>

      {/* Return type */}
      {ix.returns && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Returns</span>
          <span className="font-mono">{typeToString(ix.returns as AnchorType)}</span>
        </div>
      )}

      {/* Args */}
      {ix.args.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Arguments</p>
          <div className="rounded border divide-y">
            {ix.args.map((arg) => (
              <div key={arg.name} className="flex items-start gap-2 px-2 py-1.5">
                <span className="font-mono font-medium w-36 shrink-0">{arg.name}</span>
                <span className="font-mono text-muted-foreground">{typeToString(arg.type)}</span>
                {arg.docs && arg.docs.length > 0 && (
                  <span className="text-muted-foreground italic ml-auto text-right">{arg.docs.join(' ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts */}
      {ix.accounts.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Accounts</p>
          <div className="rounded border divide-y">
            {ix.accounts.map((acct) => (
              <div key={acct.name} className="flex items-center gap-2 px-2 py-1.5 flex-wrap">
                <span className="font-mono font-medium w-36 shrink-0">{acct.name}</span>
                <div className="flex gap-1 flex-wrap">
                  {acct.writable && <Badge variant="secondary" className="text-[10px] py-0 px-1">writable</Badge>}
                  {acct.signer  && <Badge variant="secondary" className="text-[10px] py-0 px-1">signer</Badge>}
                  {acct.optional && <Badge variant="outline"   className="text-[10px] py-0 px-1">optional</Badge>}
                  {acct.address && (
                    <span className="font-mono text-muted-foreground text-[10px]">{truncateAddress(acct.address)}</span>
                  )}
                  {acct.pda && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1">PDA</Badge>
                  )}
                </div>
                {acct.docs && acct.docs.length > 0 && (
                  <span className="text-muted-foreground italic w-full pl-36">{acct.docs.join(' ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleRow>
  )
}

// ---- Type detail ------------------------------------------------------------

function TypeDetail({ def }: { def: AnchorTypeDef }) {
  const { kind } = def.type
  return (
    <CollapsibleRow
      label={def.name}
      badge={<Badge variant="outline" className="text-xs py-0">{kind}</Badge>}
    >
      {def.docs && def.docs.length > 0 && (
        <p className="text-muted-foreground italic">{def.docs.join(' ')}</p>
      )}

      {kind === 'struct' && def.type.fields && def.type.fields.length > 0 && (
        <div className="rounded border divide-y">
          {def.type.fields.map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-2 py-1.5">
              <span className="font-mono font-medium w-36 shrink-0">{f.name}</span>
              <span className="font-mono text-muted-foreground">{typeToString(f.type)}</span>
            </div>
          ))}
        </div>
      )}

      {kind === 'enum' && def.type.variants && (
        <div className="rounded border divide-y">
          {def.type.variants.map((v) => (
            <div key={v.name} className="px-2 py-1.5 space-y-1">
              <span className="font-mono font-medium">{v.name}</span>
              {v.fields && v.fields.length > 0 && (
                <div className="pl-4 space-y-0.5">
                  {v.fields.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-mono text-muted-foreground w-32">{f.name}</span>
                      <span className="font-mono text-muted-foreground">{typeToString(f.type)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleRow>
  )
}

// ---- Event detail -----------------------------------------------------------

function EventDetail({ def }: { def: AnchorEventDef }) {
  return (
    <CollapsibleRow
      label={def.name}
      badge={<Badge variant="outline" className="text-xs py-0">{def.fields.length} fields</Badge>}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0">Discriminator</span>
        <DiscriminatorBadge bytes={def.discriminator} />
      </div>

      {def.fields.length > 0 && (
        <div className="rounded border divide-y pt-1">
          {def.fields.map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-2 py-1.5">
              <span className="font-mono font-medium w-36 shrink-0">{f.name}</span>
              <span className="font-mono text-muted-foreground">{typeToString(f.type)}</span>
              {f.index && <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-auto">index</Badge>}
            </div>
          ))}
        </div>
      )}
    </CollapsibleRow>
  )
}

// ---- IdlCard ----------------------------------------------------------------

function IdlCard({ stored, isActive }: { stored: StoredIdl; isActive: boolean }) {
  const { removeIdl, setActiveIdl } = useIdlStore()
  const [copied, setCopied] = useState(false)
  const { idl } = stored

  const copy = () => {
    navigator.clipboard.writeText(stored.programId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const hasAccounts  = (idl.accounts?.length  ?? 0) > 0
  const hasTypes     = (idl.types?.length      ?? 0) > 0
  const hasEvents    = (idl.events?.length     ?? 0) > 0
  const hasErrors    = (idl.errors?.length     ?? 0) > 0
  const hasConstants = (idl.constants?.length  ?? 0) > 0

  return (
    <Card className={isActive ? 'border-primary' : ''}>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileJson className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium">{stored.name}</CardTitle>
              {idl.metadata.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{idl.metadata.description}</p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs font-mono text-muted-foreground">{truncateAddress(stored.programId)}</span>
                <Button variant="ghost" size="icon" className="size-4" onClick={copy}>
                  {copied ? <CheckCircle2 className="size-3 text-green-500" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isActive && <Badge variant="secondary" className="text-xs">Active</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setActiveIdl(stored.id)} disabled={isActive}>Use</Button>
            <Button variant="ghost" size="icon" onClick={() => removeIdl(stored.id)} className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary" className="text-xs font-normal">{idl.instructions.length} instructions</Badge>
          {hasAccounts  && <Badge variant="secondary" className="text-xs font-normal">{idl.accounts!.length} accounts</Badge>}
          {hasTypes     && <Badge variant="secondary" className="text-xs font-normal">{idl.types!.length} types</Badge>}
          {hasEvents    && <Badge variant="secondary" className="text-xs font-normal">{idl.events!.length} events</Badge>}
          {hasErrors    && <Badge variant="secondary" className="text-xs font-normal">{idl.errors!.length} errors</Badge>}
          {hasConstants && <Badge variant="secondary" className="text-xs font-normal">{idl.constants!.length} constants</Badge>}
          <Badge variant="outline" className="text-xs font-normal">v{idl.metadata.version}</Badge>
        </div>
      </CardHeader>

      {/* Tabbed explorer */}
      <CardContent className="pt-0">
        <Tabs defaultValue="instructions">
          <TabsList className="h-7 text-xs">
            <TabsTrigger value="instructions" className="text-xs px-2 h-6">Instructions</TabsTrigger>
            {hasAccounts && <TabsTrigger value="accounts"     className="text-xs px-2 h-6">Accounts</TabsTrigger>}
            {hasTypes    && <TabsTrigger value="types"        className="text-xs px-2 h-6">Types</TabsTrigger>}
            {hasEvents   && <TabsTrigger value="events"       className="text-xs px-2 h-6">Events</TabsTrigger>}
            {hasErrors   && <TabsTrigger value="errors"       className="text-xs px-2 h-6">Errors</TabsTrigger>}
            {hasConstants && <TabsTrigger value="constants"   className="text-xs px-2 h-6">Constants</TabsTrigger>}
          </TabsList>

          {/* Instructions */}
          <TabsContent value="instructions" className="mt-3 space-y-1.5">
            {idl.instructions.map((ix) => (
              <InstructionDetail key={ix.name} ix={ix} />
            ))}
          </TabsContent>

          {/* Accounts */}
          {hasAccounts && (
            <TabsContent value="accounts" className="mt-3 space-y-1.5">
              {idl.accounts!.map((acct) => (
                <CollapsibleRow
                  key={acct.name}
                  label={acct.name}
                  badge={<Badge variant="outline" className="text-xs py-0">account</Badge>}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Discriminator</span>
                    <DiscriminatorBadge bytes={acct.discriminator} />
                  </div>
                  {/* If a matching type definition exists, show its fields */}
                  {idl.types?.find((t) => t.name === acct.name) && (() => {
                    const def = idl.types!.find((t) => t.name === acct.name)!
                    return def.type.fields && def.type.fields.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Fields</p>
                        <div className="rounded border divide-y">
                          {def.type.fields.map((f) => (
                            <div key={f.name} className="flex items-center gap-2 px-2 py-1.5">
                              <span className="font-mono font-medium w-36 shrink-0">{f.name}</span>
                              <span className="font-mono text-muted-foreground">{typeToString(f.type)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}
                </CollapsibleRow>
              ))}
            </TabsContent>
          )}

          {/* Types */}
          {hasTypes && (
            <TabsContent value="types" className="mt-3 space-y-1.5">
              {idl.types!.map((def) => (
                <TypeDetail key={def.name} def={def} />
              ))}
            </TabsContent>
          )}

          {/* Events */}
          {hasEvents && (
            <TabsContent value="events" className="mt-3 space-y-1.5">
              {idl.events!.map((ev) => (
                <EventDetail key={ev.name} def={ev} />
              ))}
            </TabsContent>
          )}

          {/* Errors */}
          {hasErrors && (
            <TabsContent value="errors" className="mt-3">
              <div className="rounded border divide-y">
                {idl.errors!.map((err) => (
                  <div key={err.code} className="flex items-start gap-3 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground w-14 shrink-0">{err.code}</span>
                    <span className="font-mono font-medium w-40 shrink-0">{err.name}</span>
                    {err.msg && <span className="text-muted-foreground">{err.msg}</span>}
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {/* Constants */}
          {hasConstants && (
            <TabsContent value="constants" className="mt-3">
              <div className="rounded border divide-y">
                {idl.constants!.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="font-mono font-medium w-40 shrink-0">{c.name}</span>
                    <span className="font-mono text-muted-foreground w-28 shrink-0">{typeToString(c.type)}</span>
                    <span className="font-mono">{c.value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ---- Page -------------------------------------------------------------------

export function IdlPage() {
  const { idls, activeIdlId, addIdl } = useIdlStore()
  const [pastedJson, setPastedJson] = useState('')
  const [validating, setValidating] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLoad = useCallback((raw: string) => {
    setValidating(true)
    setJsonError(null)
    try {
      const idl = parseAndValidateIdl(raw)
      const stored = idlToStoredIdl(idl)
      addIdl(stored)
      setPastedJson('')
      toast.success(`Loaded IDL: ${stored.name}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setJsonError(msg)
      toast.error('Invalid IDL: ' + msg)
    } finally {
      setValidating(false)
    }
  }, [addIdl])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => handleLoad(ev.target?.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }, [handleLoad])

  const handlePasteLoad = useCallback(() => {
    if (!pastedJson.trim()) return
    handleLoad(pastedJson)
  }, [pastedJson, handleLoad])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Programs / IDL</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Load Anchor IDL files to explore program interfaces.
        </p>
      </div>

      {/* Load IDL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Load an IDL</CardTitle>
          <CardDescription>Upload a .json file or paste IDL JSON directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload">
            <TabsList>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
              <TabsTrigger value="paste">Paste JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload IDL JSON</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Anchor IDL .json files</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                placeholder="Paste Anchor IDL JSON here…"
                value={pastedJson}
                onChange={(e) => { setPastedJson(e.target.value); setJsonError(null) }}
                className="font-mono text-xs min-h-48 resize-y"
              />
              {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
              <Button onClick={handlePasteLoad} disabled={validating || !pastedJson.trim()}>
                Load IDL
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Loaded IDLs */}
      {idls.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Loaded Programs ({idls.length})
            </h2>
            {idls.map((stored) => (
              <IdlCard key={stored.id} stored={stored} isActive={stored.id === activeIdlId} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileJson className="size-10 opacity-30" />
          <p className="text-sm">No IDLs loaded yet.</p>
        </div>
      )}
    </div>
  )
}
