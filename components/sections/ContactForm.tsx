"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { store, type ContactDraft, type ContactField, type ContactStatus } from "@/lib/store";

// Web3Forms access keys are public by design (they only allow sending to the owner's inbox).
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "644d0607-22ea-4461-9c1f-a7ab9357d47a";
const EMPTY: ContactDraft = { name: "", email: "", subject: "", message: "" };

interface ContactFormProps {
  icons: { send: ReactNode; success: ReactNode; error: ReactNode };
}

/**
 * Contact form posting to Web3Forms. While the visitor types, the draft is
 * mirrored to the mail app on the 3D monitor and the 3D keyboard presses
 * the same keys.
 */
export function ContactForm({ icons }: ContactFormProps) {
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [status, setStatus] = useState<ContactStatus>("idle");

  const updateStatus = (next: ContactStatus) => {
    setStatus(next);
    store.setState({ contactStatus: next });
  };

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as ContactField;
    const value = e.target.value;
    const before = draft[field];
    const next = { ...draft, [field]: value };
    setDraft(next);
    store.setState({ contact: next });
    if (value.length > before.length) {
      const caret = e.target.selectionStart ?? value.length;
      const ch = value[Math.max(0, caret - 1)] ?? "";
      store.pressKey(ch === "\n" ? "Enter" : ch);
    } else if (value.length < before.length) {
      store.pressKey("Backspace");
    }
    if (status === "sent" || status === "error") updateStatus("idle");
  };

  const onFocus = (field: ContactField) => store.setState({ contactField: field });
  const onBlur = () => store.setState({ contactField: null });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("botcheck")) return;
    updateStatus("sending");
    store.pressKey("Enter");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          from_name: "Portfolio contact form",
          name: draft.name,
          email: draft.email,
          subject: draft.subject,
          message: draft.message,
        }),
      });
      const result = (await response.json()) as { success?: boolean };
      if (!response.ok || !result.success) throw new Error("Web3Forms rejected the message");
      setDraft(EMPTY);
      store.setState({ contact: EMPTY });
      updateStatus("sent");
    } catch {
      updateStatus("error");
    }
  };

  const field = (name: ContactField) => ({
    name,
    id: `contact-${name}`,
    value: draft[name],
    onChange,
    onFocus: () => onFocus(name),
    onBlur,
    required: true,
  });

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <div className="contact-form__row">
        <div className="field">
          <label htmlFor="contact-name">Your name</label>
          <input {...field("name")} type="text" autoComplete="name" placeholder="Jane Doe" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="contact-email">Your email</label>
          <input {...field("email")} type="email" autoComplete="email" placeholder="jane@company.com" maxLength={160} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="contact-subject">Subject</label>
        <input {...field("subject")} type="text" placeholder="What are we building?" maxLength={160} />
      </div>
      <div className="field">
        <label htmlFor="contact-message">Your message</label>
        <textarea {...field("message")} rows={4} placeholder="Tell me about the project, timeline and goals…" maxLength={4000} />
      </div>
      <input type="checkbox" name="botcheck" className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="contact-form__footer">
        <button type="submit" className="btn btn--primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
          {icons.send}
        </button>
        <p className={`form-status form-status--${status}`} role="status" aria-live="polite">
          {status === "sent" ? (
            <>
              {icons.success} Message sent. I’ll get back to you soon.
            </>
          ) : status === "error" ? (
            <>
              {icons.error} Couldn’t send it. Please email me directly.
            </>
          ) : (
            <span className="form-status__hint">Watch the monitor while you type.</span>
          )}
        </p>
      </div>
    </form>
  );
}
