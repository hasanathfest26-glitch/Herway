export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackEvent {
  id: number;
  tone: FeedbackTone;
  title: string;
  message?: string;
}

type Listener = (event: FeedbackEvent) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showFeedback(
  input:
    | string
    | {
        tone?: FeedbackTone;
        title: string;
        message?: string;
      },
) {
  const payload: FeedbackEvent =
    typeof input === 'string'
      ? { id: nextId++, tone: 'info', title: input }
      : {
          id: nextId++,
          tone: input.tone ?? 'info',
          title: input.title,
          message: input.message,
        };

  for (const listener of listeners) {
    listener(payload);
  }
}

export function subscribeFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
