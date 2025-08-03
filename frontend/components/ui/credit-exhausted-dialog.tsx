'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Mail, CreditCard, AlertTriangle, Copy } from 'lucide-react'

interface CreditExhaustedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  remainingCredits: number
}

export function CreditExhaustedDialog({ 
  open, 
  onOpenChange, 
  remainingCredits 
}: CreditExhaustedDialogProps) {
  const handleContactSupport = () => {
    window.open('mailto:subasgupta@outlook.com?subject=Request for Additional Credits&body=Hello,%0A%0AI would like to request additional credits for my account.%0A%0AThank you.', '_blank')
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('subasgupta@outlook.com')
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy email:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Credits Exhausted
            </div>
          </DialogTitle>
          <DialogDescription>
            You have used all your available credits and cannot send more requests.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Credits Remaining</span>
                </div>
                <Badge variant="destructive">
                  {remainingCredits}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              To continue using the platform, please contact our support team to get additional credits.
            </AlertDescription>
          </Alert>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <code className="text-sm">subasgupta@outlook.com</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleContactSupport}>
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}