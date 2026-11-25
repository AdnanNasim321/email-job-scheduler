
import { useEffect, useState } from "react";
import axios from "axios";

interface Recipient {
  id: string;
  address: string;
  status: string;
}

interface ScheduledEmail {
  id: string;
  subject: string;
  scheduledAt: string | null;
  status: string;
  recipients: Recipient[];
}

function Scheduled() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchScheduledEmails = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/emails/scheduled",
          { withCredentials: true }
        );

        setEmails(response.data.data || []);
      } catch (err) {
        console.error("Failed to fetch scheduled emails:", err);
        setError("Unable to load scheduled emails.");
      } finally {
        setLoading(false);
      }
    };

    fetchScheduledEmails();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Scheduled Emails</h2>
        <p className="mt-2 text-slate-400">
          View and manage your upcoming scheduled emails.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 text-sm text-slate-400">
              <tr>
                <th className="p-5">Subject</th>
                <th className="p-5">Recipients</th>
                <th className="p-5">Scheduled At</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    Loading scheduled emails...
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
                    No scheduled emails yet.
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
                      {email.scheduledAt
                        ? new Date(email.scheduledAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-5">
                      <span className="text-blue-400">{email.status}</span>
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

export default Scheduled;
