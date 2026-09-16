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
    <Card className={cn("flex flex-col items-center gap-3 p-6 text-center", className)}>
      <Lock className="h-5 w-5 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">{message}</p>
      <Button variant="outline" onClick={onUnlock}>
        Unlock
      </Button>
    </Card>
  );
}
