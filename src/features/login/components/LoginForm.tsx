import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useConnectionStore } from "../../../stores/connection";
import { slowStateCopy } from "../../../errors/slow";
import { InlineError } from "../../../errors/InlineError";
import { Button } from "../../../ui/Button";
import { IconButton } from "../../../ui/IconButton";
import { Input } from "../../../ui/Input";
import { Spinner } from "../../../ui/Spinner";
import { cn } from "../../../ui/cn";
import { loginErrorCopy } from "../copy";
import { useLogin, type LoginOutcome } from "../hooks/useLogin";
import { useRateLimitCountdown } from "../hooks/useRateLimitCountdown";
import { DemoHints } from "./DemoHints";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof schema>;

export interface LoginFormProps {
  variant?: "page" | "dialog";
  onSuccess: () => void;
}

export function LoginForm({ variant = "page", onSuccess }: LoginFormProps) {
  const id = useId();
  const login = useLogin();
  const network = useConnectionStore((state) => state.network);
  const offline = network === "offline";
  const [passwordVisible, setPasswordVisible] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const remaining = useRateLimitCountdown(login.error);
  const rateLimited = remaining !== null && remaining > 0;

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  const copy = login.error
    ? loginErrorCopy(login.error, { remainingSec: remaining ?? undefined })
    : null;

  function handleOutcome(outcome: LoginOutcome): void {
    if (outcome.status === "success") {
      onSuccess();
      return;
    }
    if (outcome.status === "error") {
      if (outcome.clearPassword) setValue("password", "");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  async function onSubmit(values: LoginValues): Promise<void> {
    handleOutcome(await login.submit(values.email, values.password));
  }

  async function retry(): Promise<void> {
    handleOutcome(await login.retry(getValues("email"), getValues("password")));
  }

  const disabled = login.pending || offline || rateLimited;

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className={cn("space-y-4", variant === "dialog" && "space-y-3")}
      aria-describedby={offline ? `${id}-offline` : undefined}
    >
      <div className="space-y-3">
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type={passwordVisible ? "text" : "password"}
          autoComplete="current-password"
          error={errors.password?.message}
          trailing={
            <IconButton
              label={passwordVisible ? "Hide password" : "Show password"}
              size="sm"
              onClick={() => setPasswordVisible((visible) => !visible)}
              icon={
                passwordVisible ? (
                  <EyeOff aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />
                ) : (
                  <Eye aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />
                )
              }
            />
          }
          {...register("password")}
        />
      </div>

      <div ref={errorRef} tabIndex={-1} className="focus-visible:outline-none">
        {login.error && copy ? (
          <InlineError
            id={`${id}-error`}
            error={login.error}
            copy={copy}
            onRetry={
              login.error.kind === "network" || login.error.kind === "timeout"
                ? () => void retry()
                : undefined
            }
          />
        ) : null}
      </div>

      {login.slow ? (
        <output className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Spinner />
          <span>{slowStateCopy(login.slow)}</span>
          {login.slow === "long" ? (
            <>
              <Button size="sm" variant="ghost" onClick={login.cancel}>
                Cancel
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void retry()}>
                Retry
              </Button>
            </>
          ) : null}
        </output>
      ) : null}

      {offline ? (
        <p id={`${id}-offline`} className="text-xs text-muted">
          You're offline. Reconnect to sign in.
        </p>
      ) : null}

      <Button
        ref={submitRef}
        type="submit"
        variant="primary"
        className="w-full"
        loading={login.pending}
        disabled={disabled}
        aria-describedby={offline ? `${id}-offline` : undefined}
      >
        Sign in
      </Button>

      <DemoHints
        submitRef={submitRef}
        onPrefill={(email, password) => {
          setValue("email", email, { shouldValidate: true });
          setValue("password", password, { shouldValidate: true });
        }}
      />
    </form>
  );
}
