import * as React from "react"
import {
  IconBrain,
  IconChevronDown,
  IconCloud,
  IconCpu,
  IconLock,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MODELS,
  PROVIDER_LABELS,
  type ModelOption,
  type ModelProvider,
} from "@/config/models"
import { formatTokens } from "@/lib/format"

const PROVIDERS = Object.keys(PROVIDER_LABELS) as ModelProvider[]

interface ModelSelectorProps {
  model: ModelOption
  onModelChange: (id: string) => void
  disabled?: boolean
}

export function ModelSelector({
  model,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  const ProviderIcon = model.provider === "ollama" ? IconCpu : IconCloud

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <InputGroupButton
              size="sm"
              variant="ghost"
              aria-label={`Model: ${model.label}`}
            >
              <ProviderIcon data-icon="inline-start" />
              {model.label}
              <IconChevronDown data-icon="inline-end" />
            </InputGroupButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Choose the model</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={model.id} onValueChange={onModelChange}>
          {PROVIDERS.map((provider, index) => {
            const models = MODELS.filter((item) => item.provider === provider)
            if (models.length === 0) return null

            return (
              <React.Fragment key={provider}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {PROVIDER_LABELS[provider]}
                  </DropdownMenuLabel>
                  {models.map((item) => (
                    <DropdownMenuRadioItem
                      key={item.id}
                      value={item.id}
                      disabled={item.locked}
                      className="items-start"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          {item.locked ? (
                            <IconLock
                              aria-label="Locked"
                              className="text-muted-foreground"
                            />
                          ) : null}
                          {item.label}
                          {item.supportsThinking ? (
                            <IconBrain
                              aria-label="Supports thinking"
                              className="text-muted-foreground"
                            />
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.locked
                            ? "Not available yet"
                            : `${item.description} · ${formatTokens(item.contextWindow)} context`}
                        </span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              </React.Fragment>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
