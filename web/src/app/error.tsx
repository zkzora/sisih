"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>We couldn’t open this view.</h1>
      <p>
        Your saved demo workspace is still in this browser. Try loading the view
        again.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
