"use client";

import Link from "next/link";
import { useActionState, type ReactElement } from "react";

import { Button, Input, Label } from "@agentforge/ui";

import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  type AuthActionState,
} from "@/modules/auth/actions";

const initialState: AuthActionState = {};

function GoogleSignInButton({ next }: { next?: string }): ReactElement {
  return (
    <form action={signInWithGoogleAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button type="submit" variant="outline">
        Continue with Google
      </Button>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or use email
        <span className="bg-border h-px flex-1" />
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }): ReactElement | null {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-danger text-sm">
      {message}
    </p>
  );
}

export function SignInForm({ next }: { next?: string }): ReactElement {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton next={next} />
      <form action={action} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-accent text-xs hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </div>
        <FieldError message={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

export function SignUpForm(): ReactElement {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton />
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
          />
        </div>
        <FieldError message={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

export function ForgotPasswordForm(): ReactElement {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </div>
      <FieldError message={state.error} />
      {state.success ? (
        <p role="status" className="text-muted-foreground text-sm">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm(): ReactElement {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
