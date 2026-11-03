import { motion } from "motion/react"
import { IconPlugConnectedX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { fadeUp } from "@/lib/motion"

export function UsageError({
  error,
  onRetry,
}: Readonly<{ error: string; onRetry: () => void }>) {
  return (
    <motion.div variants={fadeUp}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconPlugConnectedX />
          </EmptyMedia>
          <EmptyTitle>Usage unavailable</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  )
}
