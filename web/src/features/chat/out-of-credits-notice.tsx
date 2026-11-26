import {
  IconAlertCircle,
  IconBrandLinkedin,
  IconRefresh,
} from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LINKEDIN_URL } from "@/config/contact"
import { cn } from "@/lib/utils"

/** Shown whenever the API or the model behind it fails. */
export function OutOfCreditsNotice({
  detail,
  onRetry,
  canRetry = true,
  className,
}: {
  detail?: string
  onRetry?: () => void
  canRetry?: boolean
  className?: string
}) {
  return (
    <Alert variant="destructive" className={cn("max-w-xl", className)}>
      <IconAlertCircle />
      <AlertTitle>Acabaram os créditos do Pedro</AlertTitle>
      <AlertDescription>
        Avisa ele no LinkedIn.
        {detail ? (
          <span className="mt-1 block text-xs opacity-80">{detail}</span>
        ) : null}
      </AlertDescription>
      <div className="col-start-2 mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
            <IconBrandLinkedin data-icon="inline-start" />
            Avisar no LinkedIn
          </a>
        </Button>
        {onRetry ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={!canRetry}
          >
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}
