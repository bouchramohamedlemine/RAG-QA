"use client";

import { useRef, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error" | "limit";

const EXIT_MS = 160;

function PaperPlane() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 3 3 10.5l7 3 3 7.5z" />
      <path d="M21 3 10 13.5" />
    </svg>
  );
}

/** A fixed button that opens the feedback form over a blurred page. */
export default function Feedback() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function open() {
    dialogRef.current?.showModal();
    nameRef.current?.focus();
  }

  // Play the exit animation first, then really close
  function close() {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.classList.contains("closing")) return;
    dialog.classList.add("closing");
    window.setTimeout(() => {
      dialog.close();
      dialog.classList.remove("closing");
    }, EXIT_MS);
  }

  function handleClosed() {
    setStatus((current) => (current === "sent" ? "idle" : current));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      if (res.status === 429) return setStatus("limit");
      if (!res.ok) return setStatus("error");
      setName("");
      setEmail("");
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" className="feedback-button" onClick={open}>
        <PaperPlane />
        Feedback
      </button>

      {/* Clicking the blurred area outside the form closes it */}
      <dialog
        ref={dialogRef}
        className="feedback-dialog"
        aria-label="Share your thoughts"
        onClose={handleClosed}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="feedback-panel">
          <button type="button" className="feedback-close" aria-label="Close" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l10 10M14 4 4 14" />
            </svg>
          </button>

          {status === "sent" ? (
            <p className="feedback-thanks">Thank you for your feedback.</p>
          ) : (
            <form onSubmit={submit}>
              <h2>Share your thoughts</h2>
              <label htmlFor="feedback-name">Name</label>
              <input id="feedback-name" ref={nameRef} required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <label htmlFor="feedback-email">Email</label>
              <input id="feedback-email" type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="feedback-message">Feedback</label>
              <textarea id="feedback-message" rows={5} required maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
              <input className="feedback-hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
              {status === "error" && <p role="alert">Sorry, that didn&apos;t send. Please try again.</p>}
              {status === "limit" && <p role="alert">You&apos;ve sent a lot of feedback today. Thank you, and please try again tomorrow.</p>}
              <button type="submit" className="feedback-send" disabled={status === "sending"}>
                <PaperPlane />
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
