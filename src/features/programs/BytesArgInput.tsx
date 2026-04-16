import { useCallback } from 'react'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  type SchemaField,
  type FieldType,
  fieldByteSize,
  fieldTypeLabel,
  validateField,
  serializeSchema,
  toHexDisplay,
  defaultValue,
} from '@/lib/solana/serialize'

// ---- Field row -------------------------------------------------------------

function FieldRow({
  field,
  onUpdate,
  onRemove,
}: {
  field: SchemaField
  onUpdate: (patch: Partial<SchemaField>) => void
  onRemove: () => void
}) {
  const error = validateField(field)
  const size = fieldByteSize(field)

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs shrink-0">{field.type}</Badge>
        <span className="text-xs text-muted-foreground shrink-0 ml-auto">{size}B</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {field.type === 'bool' ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={field.value === 'true' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onUpdate({ value: 'true' })}
          >
            true
          </Button>
          <Button
            type="button"
            variant={field.value === 'false' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onUpdate({ value: 'false' })}
          >
            false
          </Button>
        </div>
      ) : field.type === 'string' ? (
        <div className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <Input
              placeholder="String value"
              value={field.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="h-7 text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">max</span>
            <Input
              type="number"
              min="1"
              max="1024"
              value={field.maxLength ?? 32}
              onChange={(e) =>
                onUpdate({ maxLength: Math.max(1, parseInt(e.target.value) || 32) })
              }
              className="h-7 w-16 text-xs"
            />
            <span className="text-xs text-muted-foreground">B</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            placeholder={
              field.type === 'bytes'  ? 'hex e.g. deadbeef' :
              field.type === 'pubkey' ? 'base58 pubkey' : '0'
            }
            value={field.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="h-7 text-xs font-mono"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ---- Main component --------------------------------------------------------

interface BytesArgInputProps {
  fields: SchemaField[]
  onChange: (fields: SchemaField[]) => void
  /** For fixed-size [u8; N] arrays — shows required byte count and warns on mismatch. */
  fixedLength?: number
}

export function BytesArgInput({ fields, onChange, fixedLength }: BytesArgInputProps) {
  const addField = useCallback(
    (type: FieldType) => {
      onChange([
        ...fields,
        { id: crypto.randomUUID(), name: '', type, value: defaultValue(type) },
      ])
    },
    [fields, onChange],
  )

  const updateField = useCallback(
    (id: string, patch: Partial<SchemaField>) => {
      onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    },
    [fields, onChange],
  )

  const removeField = useCallback(
    (id: string) => {
      onChange(fields.filter((f) => f.id !== id))
    },
    [fields, onChange],
  )

  const serialized = serializeSchema(fields)
  const totalBytes = serialized?.length ?? 0
  const lengthMismatch = fixedLength !== undefined && totalBytes !== fixedLength

  return (
    <div className="space-y-2">
      {/* Field list */}
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              onUpdate={(patch) => updateField(field.id, patch)}
              onRemove={() => removeField(field.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {fields.length === 0 && (
        <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
          No fields — click "Add Field" to build the byte array
        </div>
      )}

      {/* Hex preview */}
      {serialized && serialized.length > 0 && (
        <div className={`rounded-md p-2 ${lengthMismatch ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted'}`}>
          <p className="text-xs text-muted-foreground mb-1">
            {totalBytes} bytes
            {fixedLength !== undefined && (
              <span className={lengthMismatch ? 'text-destructive ml-1 font-medium' : 'ml-1 opacity-60'}>
                (need exactly {fixedLength})
              </span>
            )}
          </p>
          <pre className="text-xs font-mono break-all whitespace-pre-wrap text-foreground/80">
            {toHexDisplay(serialized)}
          </pre>
        </div>
      )}

      {/* Add field button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full">
            <Plus className="size-3" />
            Add Field
            <ChevronDown className="size-3 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Unsigned integers
          </DropdownMenuLabel>
          {(['u8', 'u16', 'u32', 'u64'] as FieldType[]).map((t) => (
            <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
              {t}
              <span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Signed integers
          </DropdownMenuLabel>
          {(['i8', 'i16', 'i32', 'i64'] as FieldType[]).map((t) => (
            <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
              {t}
              <span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Other
          </DropdownMenuLabel>
          {(['bool', 'pubkey', 'string', 'bytes'] as FieldType[]).map((t) => (
            <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
              {t}
              <span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Serialize a field list to a hex string (empty string if invalid). */
export function serializeFieldsToHex(fields: SchemaField[]): string {
  if (fields.length === 0) return ''
  const bytes = serializeSchema(fields)
  if (!bytes) return ''
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
