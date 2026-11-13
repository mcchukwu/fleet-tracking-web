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

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof schema>;
type DemoHintsComponent = (typeof import("./DemoHints"))["DemoHints"];

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
  const [DemoHints, setDemoHints] = useState<DemoHintsComponent | null>(null);
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

  useEffect(() => {
    let active = true;
    if (import.meta.env.DEV && import.meta.env.VITE_DEMO_HINTS === "1") {
      void import("./DemoHints").then((module) => {
        if (active) setDemoHints(() => module.DemoHints);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  const copy = login.error
    ? loginErrorCopy(login.error, { remainingSec: remaining ?? undefined })
    : null;
  const fieldErrors = [errors.email?.message, errors.password?.message].filter(
    (message): message is string => Boolean(message),
  );
  const retryable =
    login.error !== null &&
    login.error.retryable &&
    login.error.kind !== "unauthenticated" &&
    login.error.kind !== "rate_limited";
  const describedBy =
    [offline ? `${id}-offline` : "", login.error ? `${id}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

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
      aria-describedby={describedBy}
    >
      {fieldErrors.length > 1 ? (
        <div
          role="alert"
          className="border-danger bg-alert-bg text-danger rounded-md border p-3 text-sm"
        >
          <p className="font-medium">Check the highlighted fields.</p>
          <ul className="mt-1 list-inside list-disc">
            {fieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

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

      <div
        ref={errorRef}
        tabIndex={-1}
        className="focus:outline-focus-ring rounded-sm focus:outline-2 focus:outline-offset-2"
      >
        {login.error && copy ? (
          <InlineError
            id={`${id}-error`}
            error={login.error}
            copy={copy}
            onRetry={retryable ? () => void retry() : undefined}
          />
        ) : null}
      </div>

      {login.slow ? (
        <output className="text-muted flex flex-wrap items-center gap-2 text-xs">
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
        <p id={`${id}-offline`} className="text-muted text-xs">
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

      {DemoHints ? (
        <DemoHints
          submitRef={submitRef}
          onPrefill={(email, password) => {
            setValue("email", email, { shouldValidate: true });
            setValue("password", password, { shouldValidate: true });
          }}
        />
      ) : null}
    </form>
  );
}
