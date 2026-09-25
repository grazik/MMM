import { el } from "@/web/lib/dom";
import "./empty-state.css";

export const createEmptyState = (message: string) => {
  const box = el("p", "empty-state", message);
  box.setAttribute("role", "status");
  return box;
};
