import { getOwner } from "..";
import { DisposeCallback, registerDisposable } from "../core/disposer";

export function onCleanup(disposable: DisposeCallback): void {
  registerDisposable(disposable, getOwner().disposerId);
}
