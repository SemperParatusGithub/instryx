import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto relative">
        {/* Subtle turquoise radial glow — depth cue inspired by solana.com */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,oklch(0.72_0.17_185/0.07),transparent)] z-0" />
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
