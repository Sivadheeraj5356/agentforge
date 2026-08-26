import type { ReactElement } from "react";

import { Button } from "@agentforge/ui";

import { signOutAction } from "@/modules/auth/actions";

export function UserMenu({ email }: { email: string | undefined }): ReactElement {
  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3">
      <p className="text-muted-foreground truncate px-1 text-xs" title={email}>
        {email ?? "Signed in"}
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
