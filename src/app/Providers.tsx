import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
      />
    </TooltipProvider>
  )
}
