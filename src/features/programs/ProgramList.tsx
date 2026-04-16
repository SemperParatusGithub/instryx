import { HardDrive, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProgramStore } from '@/stores/programStore'

const NETWORK_LABELS: Record<string, string> = {
  localnet: 'local',
  devnet: 'dev',
  mainnet: 'main',
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function ProgramList() {
  const { programs, activeProgramId, setActiveProgram, removeProgram } = useProgramStore()

  if (programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
        <HardDrive className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No programs uploaded yet</p>
        <p className="text-xs text-muted-foreground/60">Click "Upload Program" to get started</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {programs.map((program) => {
          const deployedNetworks = Object.keys(program.deployments)
          const isActive = program.id === activeProgramId

          return (
            <button
              key={program.id}
              onClick={() => setActiveProgram(program.id)}
              className={cn(
                'w-full text-left rounded-md px-3 py-2.5 transition-colors group',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{program.name}</p>
                  <p className="text-xs opacity-60 mt-0.5">{formatSize(program.elfSize)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                    isActive
                      ? 'hover:bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground'
                      : 'hover:bg-destructive/10 hover:text-destructive',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeProgram(program.id)
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              {deployedNetworks.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {deployedNetworks.map((net) => (
                    <Badge
                      key={net}
                      variant="secondary"
                      className={cn(
                        'text-xs py-0 px-1.5 font-normal',
                        isActive && 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground',
                      )}
                    >
                      {NETWORK_LABELS[net] ?? net}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
