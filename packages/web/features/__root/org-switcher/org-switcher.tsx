"use client";

// Org switcher leaf component. Naked JSX over the presenter's hook —
// no logic, no Effect, no router calls. The Select primitive's
// `onValueChange` carries through to the presenter's `onSelect`. A
// sibling `+` button routes to the create-org flow at `/` so the
// create surface is reachable from any route without polluting the
// switcher's selection state.

import { Button } from "@org/components/primitives/button";
import { Select } from "@org/components/primitives/select";

import { useOrgSwitcherPresenter } from "./org-switcher.presenter";

export const OrgSwitcher: React.FC = () => {
  const { activeOrgId, isEmpty, onCreateNew, onSelect, options } = useOrgSwitcherPresenter();

  if (isEmpty) return null;

  return (
    <div className="flex items-center gap-1">
      <Select value={activeOrgId ?? undefined} onValueChange={onSelect}>
        <Select.Trigger className="w-[200px]" data-testid="org-switcher">
          <Select.Value placeholder="Select an organization…" />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option.id} value={option.id} data-testid="org-switcher-option">
              {option.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onCreateNew}
        title="Create a new organization"
        aria-label="Create a new organization"
        data-testid="org-switcher-create-new"
      >
        +
      </Button>
    </div>
  );
};
