import { Construction } from 'lucide-react'

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center">
        <Construction className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm mt-1">Coming in a future phase</p>
      </div>
    </div>
  )
}
