import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>This page has no allocation.</h1>
      <p>Let’s get you back to your vault.</p>
      <Link href="/" className="button button-primary">
        Back to overview
      </Link>
    </div>
  );
}
