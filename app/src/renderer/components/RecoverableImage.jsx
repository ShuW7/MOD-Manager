import React from "react";

const RETRY_DELAYS = [1000, 3000];
const RETRY_EVENT = "qaqm:retry-character-covers";

export function retryCharacterImages() {
  window.dispatchEvent(new Event(RETRY_EVENT));
}

function ImageWithRetry({ src, fallback, ...props }) {
  const [state, setState] = React.useState({
    attempt: 0,
    round: 0,
    failed: false,
  });
  const retryable = /^(qaq-character-cover:|https?:)/.test(src);

  React.useEffect(() => {
    if (
      !retryable ||
      !state.failed ||
      state.attempt >= RETRY_DELAYS.length ||
      !navigator.onLine
    )
      return;
    const timer = setTimeout(() => {
      setState((previous) => ({
        ...previous,
        attempt: previous.attempt + 1,
        failed: false,
      }));
    }, RETRY_DELAYS[state.attempt]);
    return () => clearTimeout(timer);
  }, [retryable, state]);

  React.useEffect(() => {
    if (!retryable) return;
    const recover = () =>
      setState((previous) =>
        previous.failed
          ? { attempt: 0, round: previous.round + 1, failed: false }
          : previous,
      );
    window.addEventListener("online", recover);
    window.addEventListener(RETRY_EVENT, recover);
    return () => {
      window.removeEventListener("online", recover);
      window.removeEventListener(RETRY_EVENT, recover);
    };
  }, [retryable]);

  let imageSrc = src;
  if (retryable && (state.attempt || state.round)) {
    const url = new URL(src);
    // Bypass a failed browser request, while the image protocol still uses the
    // unchanged source URL for its disk cache and concurrent-download sharing.
    url.searchParams.set("coverRetry", `${state.round}-${state.attempt}`);
    imageSrc = url.href;
  }
  if (state.failed) return fallback;
  return (
    <img
      {...props}
      src={imageSrc}
      onError={() => setState((previous) => ({ ...previous, failed: true }))}
    />
  );
}

export function RecoverableImage({ src, fallback = null, ...props }) {
  // A replaced cover gets a fresh retry budget; failed loads never erase the
  // source from the character list shared by the overview and detail rail.
  return src ? (
    <ImageWithRetry key={src} src={src} fallback={fallback} {...props} />
  ) : (
    fallback
  );
}
