import { useState } from 'react'
import { Plus, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgramList } from './ProgramList'
import { ProgramDetail } from './ProgramDetail'
import { UploadProgramDialog } from './UploadProgramDialog'
import { useProgramStore } from '@/stores/programStore'

export function ProgramsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { programs, activeProgramId, addProgram } = useProgramStore()

  const activeProgram = programs.find((p) => p.id === activeProgramId) ?? null

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-sm font-medium">Programs</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setUploadOpen(true)}
            title="Upload program"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <ProgramList />
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0">
        {activeProgram ? (
          <ProgramDetail program={activeProgram} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
            <HardDrive className="size-10 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No program selected</p>
              <p className="text-xs text-muted-foreground/60">
                Upload a compiled .so binary to get started
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4 mr-2" />
              Upload Program
            </Button>
          </div>
        )}
      </div>

      <UploadProgramDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(program) => {
          addProgram(program)
        }}
      />
    </div>
  )
}
