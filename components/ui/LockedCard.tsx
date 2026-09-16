import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/utils/cn";

type Props = {
  /** What the PIN would reveal, e.g. "Enter the PIN to view expense entries." */
  message: string;
  onUnlock: () => void;
  className?: string;
};

/** Stands in for a section that needs a PIN, with the button that asks for it. */
export default function LockedCard({ message, onUnlock, className }: Props) {
  return (
    <Card className={cn("graph-paper flex flex-col items-center gap-3 p-6 text-center", className)}>
      <span className="porthole mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunk text-brass">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted">{message}</p>
      <Button variant="outline" onClick={onUnlock}>
        Unlock
      </Button>
    </Card>
  );
}
