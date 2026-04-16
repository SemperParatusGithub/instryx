import { useRef, useState } from 'react'
import { Upload, FileJson, X, KeyRound, FolderOpen, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createKeyPairSignerFromBytes } from '@solana/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { parseAndValidateIdl } from '@/lib/idl/parseIdl'
import type { StoredProgram, AnchorIdl } from '@/types'

interface UploadProgramDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (program: StoredProgram) => void
}

/** Strip directory prefix and extension to get the base program name. */
function baseName(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/-keypair\.json$/, '').replace(/\.(so|json)$/, '')
}

export function UploadProgramDialog({ open, onOpenChange, onUploaded }: UploadProgramDialogProps) {
  const soInputRef    = useRef<HTMLInputElement>(null)
  const idlInputRef   = useRef<HTMLInputElement>(null)
  const keypairInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef   = useRef<HTMLInputElement>(null)

  const [soFile,      setSoFile]      = useState<File | null>(null)
  const [idlFile,     setIdlFile]     = useState<File | null>(null)
  const [keypairFile, setKeypairFile] = useState<File | null>(null)
  const [derivedProgramId, setDerivedProgramId] = useState<string | null>(null)
  const [name,   setName]   = useState('')
  const [loading, setLoading] = useState(false)

  // ---- Quick Import from target/ directory --------------------------------

  const handleDirChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as (File & { webkitRelativePath: string })[]
    if (!files.length) return

    // Locate files by their path segments
    const soFiles      = files.filter((f) => /\/deploy\/[^/]+\.so$/.test(f.webkitRelativePath))
    const keypairFiles = files.filter((f) => /\/deploy\/[^/]+-keypair\.json$/.test(f.webkitRelativePath))
    const idlFiles     = files.filter((f) => /\/idl\/[^/]+\.json$/.test(f.webkitRelativePath))

    if (soFiles.length === 0) {
      toast.error('No .so binary found in target/deploy/')
      return
    }

    // Pick the best-matched set: prefer the .so whose name has a matching keypair + IDL
    let chosenSo = soFiles[0]
    for (const so of soFiles) {
      const n = baseName(so.webkitRelativePath)
      const hasKeypair = keypairFiles.some((f) => baseName(f.webkitRelativePath) === n)
      const hasIdl     = idlFiles.some((f) => baseName(f.webkitRelativePath) === n)
      if (hasKeypair && hasIdl) { chosenSo = so; break }
    }

    const soName       = baseName(chosenSo.webkitRelativePath)
    const matchKeypair = keypairFiles.find((f) => baseName(f.webkitRelativePath) === soName) ?? keypairFiles[0] ?? null
    const matchIdl     = idlFiles.find((f) => baseName(f.webkitRelativePath) === soName) ?? idlFiles[0] ?? null

    setSoFile(chosenSo)
    if (!name) setName(soName)

    setIdlFile(matchIdl)
    setKeypairFile(null)
    setDerivedProgramId(null)

    if (matchKeypair) {
      try {
        const text = await matchKeypair.text()
        const arr  = JSON.parse(text.trim()) as number[]
        const signer = await createKeyPairSignerFromBytes(new Uint8Array(arr))
        setKeypairFile(matchKeypair)
        setDerivedProgramId(signer.address)
      } catch {
        toast.error('Could not parse keypair file — skipped')
      }
    }

    const parts = [chosenSo.name, matchKeypair?.name, matchIdl?.name].filter(Boolean)
    toast.success(`Loaded: ${parts.join(', ')}`)

    // Reset the dir input so the same folder can be re-selected
    if (dirInputRef.current) dirInputRef.current.value = ''
  }

  // ---- Individual file handlers -------------------------------------------

  const handleSoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSoFile(file)
    if (file && !name) setName(file.name.replace(/\.so$/, ''))
  }

  const handleIdlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdlFile(e.target.files?.[0] ?? null)
  }

  const handleKeypairChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setKeypairFile(file)
    setDerivedProgramId(null)
    if (!file) return
    try {
      const text = await file.text()
      const arr  = JSON.parse(text.trim()) as number[]
      const signer = await createKeyPairSignerFromBytes(new Uint8Array(arr))
      setDerivedProgramId(signer.address)
    } catch {
      toast.error('Invalid keypair.json — could not derive program ID')
      setKeypairFile(null)
      if (keypairInputRef.current) keypairInputRef.current.value = ''
    }
  }

  // ---- Submit -------------------------------------------------------------

  const handleSubmit = async () => {
    if (!soFile) { toast.error('Select a .so binary first'); return }

    setLoading(true)
    try {
      const elfBuf   = await soFile.arrayBuffer()
      const elfBytes = new Uint8Array(elfBuf)
      const elfBase64 = btoa(String.fromCharCode(...elfBytes))

      let idl: AnchorIdl | undefined
      if (idlFile) {
        const idlText = await idlFile.text()
        idl = parseAndValidateIdl(idlText)
      }

      let programKeypairBase64: string | undefined
      if (keypairFile) {
        const text  = await keypairFile.text()
        const arr   = JSON.parse(text.trim()) as number[]
        const bytes = new Uint8Array(arr)
        programKeypairBase64 = btoa(String.fromCharCode(...bytes))
      }

      const program: StoredProgram = {
        id: crypto.randomUUID(),
        name: name.trim() || soFile.name.replace(/\.so$/, ''),
        elfBase64,
        elfSize: elfBytes.length,
        idl,
        programKeypairBase64,
        deployments: {},
        uploadedAt: Date.now(),
      }

      if (JSON.stringify(program).length > 4_000_000) {
        toast.warning('This binary is large and may approach localStorage limits')
      }

      onUploaded(program)
      onOpenChange(false)
      resetForm()
    } catch (e) {
      toast.error('Upload failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSoFile(null)
    setIdlFile(null)
    setKeypairFile(null)
    setDerivedProgramId(null)
    setName('')
    if (soInputRef.current)      soInputRef.current.value      = ''
    if (idlInputRef.current)     idlInputRef.current.value     = ''
    if (keypairInputRef.current) keypairInputRef.current.value = ''
    if (dirInputRef.current)     dirInputRef.current.value     = ''
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
  }

  const quickImportDone = soFile && keypairFile && idlFile

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Program</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Import */}
          <div className="space-y-1.5">
            <Label className="text-xs">Quick Import</Label>
            {/* webkitdirectory is non-standard — cast to any to avoid TS error */}
            <input
              ref={dirInputRef}
              type="file"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ webkitdirectory: '' } as any)}
              onChange={handleDirChange}
              className="hidden"
            />
            <div
              className={`border-2 border-dashed rounded-md p-4 cursor-pointer transition-colors ${
                quickImportDone
                  ? 'border-green-500/50 bg-green-500/5 hover:border-green-500/70'
                  : 'border-border hover:border-primary/60'
              }`}
              onClick={() => dirInputRef.current?.click()}
            >
              {quickImportDone ? (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="font-medium">All files loaded from target/</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FolderOpen className="size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Select Anchor target/ directory</p>
                    <p className="text-xs mt-0.5 opacity-70">
                      Auto-loads .so, keypair.json, and IDL in one click
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or select files manually</span>
            <Separator className="flex-1" />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-program"
            />
          </div>

          {/* .so binary */}
          <div className="space-y-1.5">
            <Label>Program Binary (.so)</Label>
            <input ref={soInputRef} type="file" accept=".so" onChange={handleSoChange} className="hidden" />
            <div
              className="border-2 border-dashed border-border rounded-md p-4 cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => soInputRef.current?.click()}
            >
              {soFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="size-4 text-primary" />
                  <span className="font-medium">{soFile.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {(soFile.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSoFile(null); if (soInputRef.current) soInputRef.current.value = '' }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="size-6" />
                  <p className="text-sm">Click to select a .so file</p>
                </div>
              )}
            </div>
          </div>

          {/* Keypair.json */}
          <div className="space-y-1.5">
            <Label>
              Program Keypair{' '}
              <span className="text-muted-foreground font-normal text-xs">
                (target/deploy/&lt;name&gt;-keypair.json)
              </span>
            </Label>
            <input ref={keypairInputRef} type="file" accept=".json" onChange={handleKeypairChange} className="hidden" />
            <div
              className="border border-dashed border-border rounded-md p-3 cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => keypairInputRef.current?.click()}
            >
              {keypairFile ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 text-primary" />
                    <span className="font-medium">{keypairFile.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setKeypairFile(null)
                        setDerivedProgramId(null)
                        if (keypairInputRef.current) keypairInputRef.current.value = ''
                      }}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  {derivedProgramId && (
                    <p className="text-xs text-green-500 font-mono truncate pl-6">
                      {derivedProgramId}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="size-4" />
                  <p className="text-sm">Click to attach program keypair</p>
                </div>
              )}
            </div>
          </div>

          {/* Optional IDL */}
          <div className="space-y-1.5">
            <Label>IDL <span className="text-muted-foreground font-normal text-xs">(optional, .json)</span></Label>
            <input ref={idlInputRef} type="file" accept=".json" onChange={handleIdlChange} className="hidden" />
            <div
              className="border border-dashed border-border rounded-md p-3 cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => idlInputRef.current?.click()}
            >
              {idlFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileJson className="size-4 text-primary" />
                  <span className="font-medium">{idlFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIdlFile(null); if (idlInputRef.current) idlInputRef.current.value = '' }}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileJson className="size-4" />
                  <p className="text-sm">Click to attach an Anchor IDL</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!soFile || loading}>
            {loading ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
