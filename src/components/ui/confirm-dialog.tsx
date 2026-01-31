import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card"

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: "danger" | "warning" | "default"
}

export function ConfirmDialog({
  isOpen,
  title = "Konfirmasi",
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  onConfirm,
  onCancel,
  variant = "danger"
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const confirmButtonClass = variant === "danger" 
    ? "bg-red-600 hover:bg-red-700 text-white" 
    : variant === "warning"
    ? "bg-orange-600 hover:bg-orange-700 text-white"
    : ""

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button className={confirmButtonClass} onClick={onConfirm}>
            {confirmText}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
