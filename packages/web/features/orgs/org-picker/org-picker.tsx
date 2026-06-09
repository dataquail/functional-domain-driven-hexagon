"use client";

import { Card } from "@org/components/primitives/card";
import Link from "next/link";

import { useOrgPickerPresenter } from "./org-picker.presenter";

export const OrgPicker: React.FC = () => {
  const { isEmpty, orgs } = useOrgPickerPresenter();

  if (isEmpty) {
    return (
      <div className="rounded-lg bg-muted/50 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any organizations yet. Create one below to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="org-picker">
      {orgs.map((org) => (
        <li key={org.id}>
          <Link
            href={`/orgs/${org.id}`}
            className="block focus:outline-none"
            data-testid="org-picker-item"
            data-org-id={org.id}
          >
            <Card className="transition-shadow hover:shadow-md">
              <Card.Header>
                <Card.Title className="text-base">{org.name}</Card.Title>
              </Card.Header>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
};
