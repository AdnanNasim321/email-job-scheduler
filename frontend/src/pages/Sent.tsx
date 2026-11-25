
import { useEffect, useState } from "react";
import axios from "axios";

interface Recipient {
  id: string;
  address: string;
  status: string;
}

interface SentEmail {
  id: string;
  subject: string;
  sentAt: string | null;
  status: string;
  recipients: Recipient[];
}

function Sent() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSentEmails = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/emails/sent",
          { withCredentials: true }
        );

        setEmails(response.data.data || []);
      } catch (err) {
        console.error("Failed to fetch sent emails:", err);
        setError("Unable to load sent emails.");
      } finally {
        setLoading(false);
      }
    };

    fetchSentEmails();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Sent Emails</h2>
        <p className="mt-2 text-slate-400">
          View your email sending history.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 text-sm text-slate-400">
              <tr>
                <th className="p-5">Subject</th>
                <th className="p-5">Recipients</th>
                <th className="p-5">Sent At</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    Loading sent emails...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    No sent emails yet.
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="border-b border-slate-800">
                    <td className="p-5 text-white">{email.subject}</td>
                    <td className="p-5 text-slate-300">
                      {email.recipients
                        .map((recipient) => recipient.address)
                        .join(", ")}
                    </td>
                    <td className="p-5 text-slate-300">
                      {email.sentAt
                        ? new Date(email.sentAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-5">
                      <span className="text-green-400">{email.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Sent;
