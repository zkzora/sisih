import { notFound } from "next/navigation";
import DevStates from "./states-view";

export default function DevStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevStates />;
}
