import { memo } from "react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

const REMARK_PLUGINS = [remarkGfm]

function HighlightedCode({
  code,
  language,
}: {
  code: string
  language: string
}) {
  const lines = useHighlightedCode(code, language)

  return (
    <CodeBlock size="sm" className="my-3">
      <CodeBlockHeader>
        <CodeBlockTitle className="font-mono">{language}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

const COMPONENTS: Components = {
  p: ({ node, ...props }) => (
    <p className="leading-7 not-first:mt-4" {...props} />
  ),
  h1: ({ node, ...props }) => (
    <h3 className="mt-6 mb-2 font-display text-2xl first:mt-0" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h3 className="mt-6 mb-2 font-display text-xl first:mt-0" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h4 className="mt-5 mb-1.5 font-semibold first:mt-0" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul
      className="mt-3 flex list-disc flex-col gap-1.5 pl-5 marker:text-primary/70"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 marker:text-muted-foreground"
      {...props}
    />
  ),
  li: ({ node, ...props }) => <li className="pl-1 leading-7" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-semibold" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="mt-4 border-l-2 border-primary/40 pl-4 text-muted-foreground italic"
      {...props}
    />
  ),
  table: ({ node, ...props }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="border-b px-3 py-2 font-medium" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-b border-border/60 px-3 py-2" {...props} />
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ node, className, children, ...props }) => {
    const language = /language-(\w+)/.exec(className ?? "")?.[1]
    const text = String(children ?? "")

    if (language || text.includes("\n"))
      return <HighlightedCode code={text} language={language ?? "text"} />

    return (
      <code
        className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    )
  },
}

export const MarkdownContent = memo(function MarkdownContent({
  children,
}: {
  children: string
}) {
  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
      {children}
    </Markdown>
  )
})
