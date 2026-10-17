import { useId, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SharePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppressCloseFocus?: boolean;
}

/** Preview URL only. No session creation, invitation or shared editing. */
export function SharePopover({ open, onOpenChange, suppressCloseFocus = false }: SharePopoverProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const urlId = useId();
  const helpId = useId();
  const errorId = useId();
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [copying, setCopying] = useState(false);
  const [failed, setFailed] = useState(false);

  const changeOpen = (next: boolean) => {
    if (next) {
      setUrl(window.location.href);
      setFailed(false);
    }
    onOpenChange(next);
  };
  const copyLink = async () => {
    if (copying || !url) return;
    setCopying(true);
    setFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      setFailed(true);
    } finally {
      setCopying(false);
    }
  };

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <Button ref={trigger} className="jam-share shrink-0" size="sm" variant="outline"><Share2 />Share</Button>
    </PopoverTrigger>
    <PopoverContent data-review-transient aria-labelledby={titleId} align="end" collisionPadding={8}
      className="w-[360px] space-y-3 overflow-x-hidden"
      onOpenAutoFocus={(event) => { event.preventDefault(); field.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!suppressCloseFocus) trigger.current?.focus({ preventScroll: true });
      }}>
      <h2 id={titleId} className="text-label font-medium">Share Night bus</h2>
      <div className="min-w-0 space-y-1">
        <label htmlFor={urlId} className="text-label">Preview URL</label>
        <Input ref={field} id={urlId} readOnly value={url} aria-describedby={`${helpId}${failed ? ` ${errorId}` : ""}`}
          onFocus={(event) => event.currentTarget.select()} />
        <p id={helpId} className="text-label text-muted-foreground">This opens the UI preview. Shared editing is not connected yet.</p>
      </div>
      <Button size="sm" variant="outline" disabled={copying || !url} onClick={copyLink}><Copy />{copying ? "Copying link" : "Copy link"}</Button>
      {failed && <p id={errorId} role="status" className="text-label text-destructive">Couldn't copy the link. Select and copy it from the field.</p>}
    </PopoverContent>
  </Popover>;
}