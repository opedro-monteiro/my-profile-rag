import { motion } from "motion/react"
import { IconChartBar } from "@tabler/icons-react"
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

export function UsageEmpty() {
  return (
    <motion.div variants={fadeUp}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconChartBar />
          </EmptyMedia>
          <EmptyTitle>No usage in this range</EmptyTitle>
          <EmptyDescription>
            Every reply records its tokens, model, tools and latency here. Ask
            something in the chat to see the first numbers.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <a href="#/chat">Open the chat</a>
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  )
}
