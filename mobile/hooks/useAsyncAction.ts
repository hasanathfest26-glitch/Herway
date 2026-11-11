import { useCallback, useEffect, useRef, useState } from 'react';
import { showFeedback } from '@/services/feedback';

export type ActionStatus =
  | 'idle'
  | 'processing'
  | 'pending_confirmation'
  | 'success'
  | 'failed'
  | 'retrying';

export interface AsyncActionOptions<TArgs extends unknown[], TResult> {
  action: (...args: TArgs) => Promise<TResult>;
  pendingLabel?: string;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  resetAfterMs?: number;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: Error) => void;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  opts: AsyncActionOptions<TArgs, TResult>,
) {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      setErrorMessage(null);
      setStatus((prev) => (prev === 'failed' ? 'retrying' : 'processing'));

      try {
        const result = await opts.action(...args);
        setStatus('success');
        if (opts.successTitle) {
          showFeedback({
            tone: 'success',
            title: opts.successTitle,
            message: opts.successMessage,
          });
        }
        if (opts.onSuccess) {
          await opts.onSuccess(result);
        }
        const resetMs = opts.resetAfterMs ?? 1800;
        if (resetMs > 0) {
          resetTimerRef.current = setTimeout(() => {
            setStatus((cur) => (cur === 'success' ? 'idle' : cur));
          }, resetMs);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setStatus('failed');
        setErrorMessage(error.message);
        if (opts.errorTitle) {
          showFeedback({
            tone: 'error',
            title: opts.errorTitle,
            message: error.message,
          });
        }
        opts.onError?.(error);
        return undefined;
      } finally {
        inFlightRef.current = false;
      }
    },
    [opts],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return {
    status,
    busy: status === 'processing' || status === 'retrying' || status === 'pending_confirmation',
    errorMessage,
    run,
    reset,
  };
}
