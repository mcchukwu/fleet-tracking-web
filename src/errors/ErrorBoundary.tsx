import { Component, type ErrorInfo, type ReactNode } from "react";
import { PageFrame } from "../ui/PageFrame";
import { ErrorState } from "./ErrorState";
import { normalize } from "./normalize";
import { recordError } from "./report";
import type { AppError } from "./types";

export type BoundaryLevel = "app" | "route" | "panel";

export interface ErrorBoundaryProps {
  level: BoundaryLevel;
  children: ReactNode;
  resetKeys?: readonly unknown[];
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: AppError | null;
  resetKeys: readonly unknown[];
}

function route(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function sameKeys(previous: readonly unknown[], next: readonly unknown[]): boolean {
  return (
    previous.length === next.length && previous.every((key, index) => Object.is(key, next[index]))
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    resetKeys: this.props.resetKeys ?? [],
  };

  static getDerivedStateFromError(cause: unknown): Partial<ErrorBoundaryState> {
    return { error: normalize(cause, { route: route() }) };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    const nextKeys = props.resetKeys ?? [];
    if (!sameKeys(state.resetKeys, nextKeys)) {
      return { error: null, resetKeys: nextKeys };
    }
    return null;
  }

  componentDidCatch(cause: unknown, _info: ErrorInfo): void {
    const error = normalize(cause, { route: route() });
    recordError(error);
    this.setState({ error });
  }

  private readonly reset = () => {
    this.setState({ error: null, resetKeys: this.props.resetKeys ?? [] });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.level === "app") {
      return (
        <main className="bg-bg h-dvh">
          <PageFrame layout="scroll" align="center" contentClassName="px-4 pt-6">
            <h1 className="sr-only">Something went wrong</h1>
            <ErrorState error={error} blocking onAction={() => window.location.reload()} />
          </PageFrame>
        </main>
      );
    }

    return (
      <ErrorState
        error={error}
        compact={this.props.level === "panel"}
        blocking={this.props.level === "route"}
        onAction={this.reset}
        onRetry={this.reset}
      />
    );
  }
}
