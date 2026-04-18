import { FileJson, Zap } from 'lucide-react'
import { useIdlStore } from '@/stores/idlStore'
import { InstructionForm } from './InstructionForm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export function InstructionsPage() {
  const { idls, activeIdlId, setActiveIdl, getActiveIdl } = useIdlStore()
  const activeIdl = getActiveIdl()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instructions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invoke on-chain program instructions from your loaded IDL.
        </p>
      </div>

      {idls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileJson className="size-10 opacity-30" />
          <p className="text-sm">No IDL loaded.</p>
          <p className="text-xs">Go to Programs and upload an Anchor IDL first.</p>
        </div>
      ) : (
        <>
          {/* IDL selector */}
          {idls.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Program:</span>
              <Select value={activeIdlId ?? ''} onValueChange={setActiveIdl}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a program…" />
                </SelectTrigger>
                <SelectContent>
                  {idls.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeIdl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{activeIdl.name}</span>
                <Badge variant="secondary">{activeIdl.idl.instructions.length} instructions</Badge>
              </div>

              {activeIdl.idl.instructions.map((ix) => (
                <InstructionForm key={ix.name} instruction={ix} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a program above.</p>
          )}
        </>
      )}
    </div>
  )
}
