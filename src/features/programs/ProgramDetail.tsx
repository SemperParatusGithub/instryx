import { useState } from 'react'
import { Trash2, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeployPanel } from './DeployPanel'
import { InvokePanel } from './InvokePanel'
import { useProgramStore } from '@/stores/programStore'
import type { StoredProgram } from '@/types'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString()
}

interface ProgramDetailProps {
  program: StoredProgram
}

function OverviewTab({ program }: ProgramDetailProps) {
  const { removeProgram } = useProgramStore()

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="font-medium">{program.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Binary Size</p>
          <p className="font-medium">{formatSize(program.elfSize)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Uploaded</p>
          <p className="font-medium">{formatDate(program.uploadedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IDL</p>
          <p className="font-medium">
            {program.idl ? (
              <span className="flex items-center gap-1">
                <FileJson className="size-3.5 text-primary" />
                {program.idl.instructions.length} instructions
              </span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </p>
        </div>
      </div>

      <Separator />

      {/* Deployments table */}
      {Object.entries(program.deployments).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Deployments
          </p>
          <div className="space-y-1.5">
            {Object.entries(program.deployments).map(([net, dep]) => (
              <div key={net} className="flex items-center gap-3 text-xs py-1">
                <Badge variant="outline">{net}</Badge>
                <span className="font-mono text-muted-foreground truncate flex-1">
                  {dep.programId}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatDate(dep.deployedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IDL summary */}
      {program.idl && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              IDL Summary
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xl font-semibold">{program.idl.instructions.length}</p>
                <p className="text-xs text-muted-foreground">Instructions</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xl font-semibold">{program.idl.accounts?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Accounts</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xl font-semibold">{program.idl.types?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Types</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Remove */}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => removeProgram(program.id)}
        className="gap-2"
      >
        <Trash2 className="size-3.5" />
        Remove Program
      </Button>
    </div>
  )
}

export function ProgramDetail({ program }: ProgramDetailProps) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-base truncate">{program.name}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{formatSize(program.elfSize)}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-5 pt-3 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="deploy" className="text-xs">Deploy</TabsTrigger>
            <TabsTrigger value="invoke" className="text-xs">Invoke</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="overview" className="m-0 p-5">
            <OverviewTab program={program} />
          </TabsContent>
          <TabsContent value="deploy" className="m-0 p-5">
            <DeployPanel program={program} />
          </TabsContent>
          <TabsContent value="invoke" className="m-0 p-5">
            <InvokePanel program={program} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
