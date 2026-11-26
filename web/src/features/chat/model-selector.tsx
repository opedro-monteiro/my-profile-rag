import * as React from "react"
import {
  IconAlertTriangle,
  IconBrain,
  IconChevronDown,
  IconCloud,
  IconCpu,
  IconLock,
  IconRefresh,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PROVIDER_LABELS,
  UNAVAILABLE_REASONS,
  type ModelOption,
  type ModelProvider,
} from "@/config/models"
import { formatTokens } from "@/lib/format"
import type { ModelsState } from "./use-models"

const PROVIDERS = Object.keys(PROVIDER_LABELS) as ModelProvider[]

interface ModelSelectorProps {
  model: ModelOption | null
  models: ModelOption[]
  state: ModelsState
  onModelChange: (id: string) => void
  onRetry: () => void
  disabled?: boolean
}

function describeModel(item: ModelOption) {
  if (item.locked)
    return item.unavailableReason
      ? UNAVAILABLE_REASONS[item.unavailableReason]
      : "Not available"

  const context = item.contextWindow
    ? `${formatTokens(item.contextWindow)} context`
    : null
  return [item.description, context].filter(Boolean).join(" · ")
}

export function ModelSelector({
  model,
  models,
  state,
  onModelChange,
  onRetry,
  disabled,
}: ModelSelectorProps) {
  if (state.status === "loading")
    return (
      <InputGroupButton size="sm" variant="ghost" disabled>
        <Spinner data-icon="inline-start" aria-label="Loading models" />
        Loading models
      </InputGroupButton>
    )

  const ProviderIcon =
    state.status === "error" || !model
      ? IconAlertTriangle
      : model.provider === "ollama"
        ? IconCpu
        : IconCloud
  const label =
    state.status === "error"
      ? "Models unavailable"
      : (model?.label ?? "No model available")

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <InputGroupButton
              size="sm"
              variant="ghost"
              aria-label={model ? `Model: ${model.label}` : label}
            >
              <ProviderIcon data-icon="inline-start" />
              {label}
              <IconChevronDown data-icon="inline-end" />
            </InputGroupButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Choose the model</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-72">
        {state.status === "error" ? (
          <>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {state.error} Start it with npm run api.
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={onRetry}>
              <IconRefresh />
              Retry loading models
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuRadioGroup
          value={model?.id ?? ""}
          onValueChange={onModelChange}
        >
          {PROVIDERS.map((provider, index) => {
            const group = models.filter((item) => item.provider === provider)
            if (group.length === 0) return null

            return (
              <React.Fragment key={provider}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {PROVIDER_LABELS[provider]}
                  </DropdownMenuLabel>
                  {group.map((item) => (
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
                          {describeModel(item)}
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
