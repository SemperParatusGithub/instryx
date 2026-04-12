import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  KeyRound,
  Plus,
  Trash2,
  Download,
  Upload,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useKeypairStore } from '@/stores/keypairStore'
import {
  generateNewKeypair,
  publicKeyFromSecretBytes,
  encryptSecretKey,
  decryptSecretKey,
  downloadKeypairJson,
} from '@/lib/solana/keypairs'
import type { StoredKeypair } from '@/types'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? (
        <CheckCircle2 className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  )
}

function ExportDialog({ kp }: { kp: StoredKeypair }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!password) return
    setExporting(true)
    try {
      const secretBytes = await decryptSecretKey(kp.encryptedSecretKey, password)
      downloadKeypairJson(secretBytes, `${kp.label.replace(/\s+/g, '_')}.json`)
      toast.success('Keypair exported')
      setOpen(false)
      setPassword('')
    } catch {
      toast.error('Wrong password or corrupted data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <Download className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Keypair</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Enter the password you used to protect this keypair to export it as a Solana CLI JSON file.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExport()}
              placeholder="Enter password…"
            />
          </div>
          <Button onClick={handleExport} disabled={!password || exporting} className="w-full">
            {exporting && <Loader2 className="size-4 animate-spin mr-2" />}
            Export JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function KeypairCard({ kp }: { kp: StoredKeypair }) {
  const { removeKeypair, updateLabel } = useKeypairStore()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(kp.label)
  const [showFull, setShowFull] = useState(false)

  const saveLabel = () => {
    if (label.trim()) updateLabel(kp.id, label.trim())
    setEditing(false)
  }

  const created = new Date(kp.createdAt).toLocaleDateString()

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <KeyRound className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div className="min-w-0 space-y-1">
              {editing ? (
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={saveLabel}
                  onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
                  className="h-6 text-sm py-0"
                  autoFocus
                />
              ) : (
                <button
                  className="text-sm font-medium hover:underline text-left"
                  onClick={() => setEditing(true)}
                >
                  {kp.label}
                </button>
              )}
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {showFull ? kp.publicKey : `${kp.publicKey.slice(0, 8)}…${kp.publicKey.slice(-8)}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => setShowFull((s) => !s)}
                >
                  {showFull ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </Button>
                <CopyButton text={kp.publicKey} />
              </div>
              <div className="flex items-center gap-1">
                <Lock className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Encrypted · Created {created}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ExportDialog kp={kp} />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              onClick={() => removeKeypair(kp.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GenerateDialog() {
  const { addKeypair } = useKeypairStore()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (!password || !label.trim()) return

    setGenerating(true)
    try {
      const { publicKey, secretKeyBytes } = await generateNewKeypair()
      const encryptedSecretKey = await encryptSecretKey(secretKeyBytes, password)
      addKeypair({
        id: crypto.randomUUID(),
        label: label.trim(),
        publicKey,
        encryptedSecretKey,
        createdAt: Date.now(),
      })
      toast.success(`Keypair "${label}" generated`)
      setOpen(false)
      setLabel('')
      setPassword('')
      setConfirmPassword('')
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Generate Keypair
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate New Keypair</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The private key will be encrypted with your password and stored in your browser.
          Never share your password or private key.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              placeholder="e.g. Test Wallet"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Encrypt with password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Confirm password…"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !label.trim() || !password || password !== confirmPassword}
            className="w-full"
          >
            {generating && <Loader2 className="size-4 animate-spin mr-2" />}
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ImportDialog() {
  const { addKeypair } = useKeypairStore()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const [filePubkey, setFilePubkey] = useState<string | null>(null)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const arr = JSON.parse(text) as number[]
      if (!Array.isArray(arr) || arr.length !== 64) {
        toast.error('Invalid keypair file: expected 64-byte array')
        return
      }
      const bytes = new Uint8Array(arr)
      const pubkey = await publicKeyFromSecretBytes(bytes)
      setFileBytes(bytes)
      setFilePubkey(pubkey)
      if (!label) setLabel(file.name.replace(/\.json$/, ''))
    } catch {
      toast.error('Could not parse keypair file')
    }
    e.target.value = ''
  }, [label])

  const handleImport = async () => {
    if (!fileBytes || !password || !label.trim()) return
    setImporting(true)
    try {
      const encryptedSecretKey = await encryptSecretKey(fileBytes, password)
      addKeypair({
        id: crypto.randomUUID(),
        label: label.trim(),
        publicKey: filePubkey!,
        encryptedSecretKey,
        createdAt: Date.now(),
      })
      toast.success(`Keypair "${label}" imported`)
      setOpen(false)
      setLabel('')
      setPassword('')
      setFileBytes(null)
      setFilePubkey(null)
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Keypair</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Import a Solana CLI keypair JSON file (64-byte array). It will be encrypted with your password.
        </p>
        <div className="space-y-3">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4 mr-2" />
              {fileBytes ? 'Change File' : 'Select Keypair JSON'}
            </Button>
            {filePubkey && (
              <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                {filePubkey}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              placeholder="e.g. Imported Wallet"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Encrypt with Password</Label>
            <Input
              type="password"
              placeholder="Password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={handleImport}
            disabled={importing || !fileBytes || !password || !label.trim()}
            className="w-full"
          >
            {importing && <Loader2 className="size-4 animate-spin mr-2" />}
            Import & Encrypt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function KeypairsPage() {
  const { keypairs } = useKeypairStore()

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Keypairs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate and manage local keypairs for signing transactions.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <GenerateDialog />
        <ImportDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stored Keypairs
            {keypairs.length > 0 && (
              <Badge variant="secondary" className="ml-2">{keypairs.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Private keys are AES-256-GCM encrypted with your password before storage.
            They never leave your browser in plaintext.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keypairs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm space-y-1">
              <KeyRound className="size-8 opacity-30 mx-auto" />
              <p>No keypairs yet. Generate or import one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keypairs.map((kp) => (
                <KeypairCard key={kp.id} kp={kp} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
