import { BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAddressBookStore } from '@/stores/addressBookStore'

interface AccountInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}

export function AccountInput({ value, onChange, placeholder, readOnly, className }: AccountInputProps) {
  const entries = useAddressBookStore((s) => s.entries)

  return (
    <div className="flex gap-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Public key…'}
        readOnly={readOnly}
        className={`font-mono text-xs flex-1 ${readOnly ? 'bg-muted' : ''} ${className ?? ''}`}
      />
      {!readOnly && entries.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 size-9">
              <BookOpen className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-64 overflow-y-auto">
            {entries.map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                onSelect={() => onChange(entry.address)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="text-xs font-medium">{entry.label}</span>
                <span className="text-xs font-mono text-muted-foreground truncate w-full">
                  {entry.address}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
