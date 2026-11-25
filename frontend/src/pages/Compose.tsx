
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

interface Sender {
  id: string;
  fromAddress: string;
  displayName?: string | null;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  return apiError.response?.data?.message || fallback;
}

function Compose() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [subject, setSubject] = useState("");
  const [recipients, setRecipients] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [newSenderEmail, setNewSenderEmail] = useState("");
  const [newSenderName, setNewSenderName] = useState("");
  const [showSenderForm, setShowSenderForm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Keep the same key if a submission fails and the user retries.
  const idempotencyKey = useRef<string | null>(null);

  const fetchSenders = useCallback(async () => {
    try {
      setLoadingSenders(true);

      const response = await api.get("/senders");
      const senderList: Sender[] = response.data.data || [];

      setSenders(senderList);

      setSenderId((currentId) => {
        if (currentId && senderList.some((sender) => sender.id === currentId)) {
          return currentId;
        }

        return senderList[0]?.id || "";
      });
    } catch (err) {
      console.error("Failed to load senders:", err);
      setError(getErrorMessage(err, "Unable to load senders."));
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  useEffect(() => {
    void fetchSenders();
  }, [fetchSenders]);

  const handleAddSender = async () => {
    setError("");
    setMessage("");

    const email = newSenderEmail.trim();
    const displayName = newSenderName.trim();

    if (!email) {
      setError("Please enter a sender email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid sender email address.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/senders", {
        fromAddress: email,
        displayName: displayName || undefined,
        hourlyLimit: 0,
      });

      const newSender = response.data.data as Sender;

      setSenders((previous) => [
        newSender,
        ...previous.filter((sender) => sender.id !== newSender.id),
      ]);

      setSenderId(newSender.id);
      setNewSenderEmail("");
      setNewSenderName("");
      setShowSenderForm(false);

      setMessage("Sender added successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add sender."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (isScheduled: boolean) => {
    setError("");
    setMessage("");

    if (!senderId) {
      setError("Please select a sender.");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter an email subject.");
      return;
    }

    if (!body.trim()) {
      setError("Please enter the email body.");
      return;
    }

    const recipientList = recipients
      .split(/[,\n;]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const uniqueRecipients = [...new Set(recipientList)];

    if (uniqueRecipients.length === 0) {
      setError("Please enter at least one recipient.");
      return;
    }

    if (uniqueRecipients.length > 500) {
      setError("You can add a maximum of 500 recipients.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (uniqueRecipients.some((email) => !emailRegex.test(email))) {
      setError("One or more recipient email addresses are invalid.");
      return;
    }

    let scheduleISO: string | undefined;

    if (isScheduled) {
      if (!scheduledAt) {
        setError("Please select a schedule date and time.");
        return;
      }

      const selectedDate = new Date(scheduledAt);

      if (Number.isNaN(selectedDate.getTime())) {
        setError("Please select a valid schedule date and time.");
        return;
      }

      if (selectedDate.getTime() <= Date.now()) {
        setError("Schedule time must be in the future.");
        return;
      }

      scheduleISO = selectedDate.toISOString();
    }

    try {
      setLoading(true);

      if (!idempotencyKey.current) {
        idempotencyKey.current = crypto.randomUUID();
      }

      await api.post(
        "/emails",
        {
          senderId,
          subject: subject.trim(),
          body: body.trim(),
          recipients: uniqueRecipients,
          ...(scheduleISO ? { scheduledAt: scheduleISO } : {}),
        },
        {
          headers: {
            "Idempotency-Key": idempotencyKey.current,
          },
        }
      );

      setMessage(
        isScheduled
          ? "Email scheduled successfully!"
          : "Email queued successfully!"
      );

      setSubject("");
      setRecipients("");
      setBody("");
      setScheduledAt("");

      // A new submission should receive a new idempotency key.
      idempotencyKey.current = null;
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to submit email. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Compose Email</h2>
        <p className="mt-2 text-slate-400">
          Create and schedule your email campaign.
        </p>
      </div>

      <div className="max-w-3xl space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
        {message && (
          <div
            role="status"
            className="rounded-lg bg-green-900/30 p-3 text-green-400"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-900/30 p-3 text-red-400"
          >
            {error}
          </div>
        )}

        {/* Sender selection */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="sender" className="text-sm text-slate-300">
              Sender
            </label>

            <button
              type="button"
              onClick={() => setShowSenderForm((previous) => !previous)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showSenderForm ? "Cancel" : "+ Add Sender"}
            </button>
          </div>

          <select
            id="sender"
            value={senderId}
            onChange={(event) => setSenderId(event.target.value)}
            disabled={loadingSenders || loading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-50"
          >
            <option value="">
              {loadingSenders ? "Loading senders..." : "Select sender"}
            </option>

            {senders.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.displayName
                  ? `${sender.displayName} (${sender.fromAddress})`
                  : sender.fromAddress}
              </option>
            ))}
          </select>

          {senders.length === 0 && !loadingSenders && (
            <p className="mt-2 text-sm text-slate-500">
              No senders available. Add a sender to continue.
            </p>
          )}
        </div>

        {/* Add sender form */}
        {showSenderForm && (
          <div className="space-y-3 rounded-lg border border-slate-700 p-4">
            <h3 className="font-semibold">Add New Sender</h3>

            <input
              type="email"
              value={newSenderEmail}
              onChange={(event) => setNewSenderEmail(event.target.value)}
              placeholder="Sender email address"
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
            />

            <input
              type="text"
              value={newSenderName}
              onChange={(event) => setNewSenderName(event.target.value)}
              placeholder="Display name (optional)"
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
            />

            <button
              type="button"
              onClick={handleAddSender}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium disabled:opacity-50"
            >
              {loading ? "Adding..." : "Save Sender"}
            </button>
          </div>
        )}

        {/* Subject */}
        <div>
          <label
            htmlFor="subject"
            className="mb-2 block text-sm text-slate-300"
          >
            Subject
          </label>

          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Enter email subject"
            maxLength={500}
            disabled={loading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
          />
        </div>

        {/* Recipients */}
        <div>
          <label
            htmlFor="recipients"
            className="mb-2 block text-sm text-slate-300"
          >
            Recipients
          </label>

          <textarea
            id="recipients"
            rows={4}
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="Enter email addresses, separated by commas"
            disabled={loading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
          />

          <p className="mt-1 text-xs text-slate-500">
            Separate multiple email addresses using commas, semicolons or new
            lines. Maximum 500 recipients.
          </p>
        </div>

        {/* Email body */}
        <div>
          <label
            htmlFor="body"
            className="mb-2 block text-sm text-slate-300"
          >
            Email Body
          </label>

          <textarea
            id="body"
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your email..."
            disabled={loading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
          />
        </div>

        {/* Schedule */}
        <div>
          <label
            htmlFor="scheduledAt"
            className="mb-2 block text-sm text-slate-300"
          >
            Schedule Date & Time
          </label>

          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
          />

          <p className="mt-1 text-xs text-slate-500">
            Choose a future date and time only when using Schedule Later.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || loadingSenders || senders.length === 0}
            onClick={() => handleSubmit(false)}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Send Now"}
          </button>

          <button
            type="button"
            disabled={loading || loadingSenders || senders.length === 0}
            onClick={() => handleSubmit(true)}
            className="rounded-lg border border-slate-700 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Schedule Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Compose;
