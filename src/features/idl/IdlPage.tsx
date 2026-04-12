import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  FileJson,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
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
import type { StoredIdl } from '@/types'

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function IdlCard({ stored, isActive }: { stored: StoredIdl; isActive: boolean }) {
  const { removeIdl, setActiveIdl } = useIdlStore()
  const [expanded, setExpanded] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const { idl } = stored

  return (
    <Card className={isActive ? 'border-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileJson className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium truncate">{stored.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {truncateAddress(stored.programId)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4"
                  onClick={() => copy(stored.programId, 'pid')}
                >
                  {copiedId === 'pid' ? (
                    <CheckCircle2 className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isActive && (
              <Badge variant="secondary" className="text-xs">Active</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveIdl(stored.id)}
              disabled={isActive}
            >
              Use
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeIdl(stored.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="size-3" />
            <span>{idl.instructions.length} instructions</span>
          </div>
          {idl.accounts && idl.accounts.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="size-3" />
              <span>{idl.accounts.length} accounts</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">v{idl.metadata.version}</span>
        </div>
      </CardHeader>

      {/* Expandable instruction list */}
      <CardContent className="pt-0">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? 'Hide' : 'Show'} instructions
        </button>

        {expanded && (
          <div className="mt-3 space-y-1">
            {idl.instructions.map((ix) => (
              <div
                key={ix.name}
                className="flex items-center justify-between px-2 py-1 rounded text-xs bg-muted"
              >
                <span className="font-mono font-medium">{ix.name}</span>
                <div className="flex gap-1">
                  {ix.args.length > 0 && (
                    <Badge variant="outline" className="text-xs py-0">
                      {ix.args.length} args
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs py-0">
                    {ix.accounts.length} accts
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      handleLoad(text)
    }
    reader.readAsText(file)
    // reset so same file can be re-uploaded
    e.target.value = ''
  }, [handleLoad])

  const handlePasteLoad = useCallback(() => {
    if (!pastedJson.trim()) return
    handleLoad(pastedJson)
  }, [pastedJson, handleLoad])

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Programs / IDL</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Load Anchor IDL files to interact with your programs.
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Anchor IDL .json files
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                placeholder='Paste Anchor IDL JSON here…'
                value={pastedJson}
                onChange={(e) => {
                  setPastedJson(e.target.value)
                  setJsonError(null)
                }}
                className="font-mono text-xs min-h-48 resize-y"
              />
              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
              <Button
                onClick={handlePasteLoad}
                disabled={validating || !pastedJson.trim()}
              >
                Load IDL
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Loaded IDLs */}
      {idls.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Loaded Programs ({idls.length})
            </h2>
            {idls.map((stored) => (
              <IdlCard
                key={stored.id}
                stored={stored}
                isActive={stored.id === activeIdlId}
              />
            ))}
          </div>
        </>
      )}

      {idls.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileJson className="size-10 opacity-30" />
          <p className="text-sm">No IDLs loaded yet.</p>
        </div>
      )}
    </div>
  )
}
