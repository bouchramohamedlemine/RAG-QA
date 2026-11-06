"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error" | "limit";

/** A fixed button that opens a small feedback form. */
export default function Feedback() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    messageRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setStatus((current) => (current === "sent" ? "idle" : current));
    buttonRef.current?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, website }),
      });
      if (res.status === 429) return setStatus("limit");
      if (!res.ok) return setStatus("error");
      setMessage("");
      setEmail("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="feedback">
      {open && (
        <div className="feedback-panel" role="dialog" aria-label="Send feedback">
          {status === "sent" ? (
            <>
              <p>Thank you for your feedback.</p>
              <button type="button" className="feedback-send" onClick={close}>
                Close
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="feedback-message">Your feedback</label>
              <textarea
                id="feedback-message"
                ref={messageRef}
                rows={5}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <label htmlFor="feedback-email">Your email (optional, if you'd like a reply)</label>
              <input id="feedback-email" type="email" maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="feedback-hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
              {status === "error" && <p role="alert">Sorry, that didn't send. Please try again.</p>}
              {status === "limit" && <p role="alert">You've sent a lot of feedback today. Thank you, and please try again tomorrow.</p>}
              <div className="feedback-actions">
                <button type="button" className="feedback-cancel" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="feedback-send" disabled={status === "sending" || !message.trim()}>
                  {status === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      <button ref={buttonRef} type="button" className="feedback-button" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        Feedback
      </button>
    </div>
  );
}
