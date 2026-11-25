
import { useEffect, useState } from "react";
import axios from "axios";

interface Recipient {
  id: string;
  address: string;
}

interface Email {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  recipients: Recipient[];
}

interface DashboardData {
  total: number;
  sent: number;
  scheduled: number;
  failed: number;
  recentEmails: Email[];
}

function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    total: 0,
    sent: 0,
    scheduled: 0,
    failed: 0,
    recentEmails: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/emails/stats",
          { withCredentials: true }
        );

        setData(response.data.data);
      } catch (err) {
        console.error("Dashboard loading error:", err);
        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const statistics = [
    { title: "Total Emails", value: data.total },
    { title: "Sent", value: data.sent },
    { title: "Scheduled", value: data.scheduled },
    { title: "Failed", value: data.failed },
  ];

  return (
    <div>
      <div className="mb-10">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="mt-2 text-slate-400">
          Manage and monitor your email campaigns.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statistics.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-slate-800 bg-slate-900 p-6"
          >
            <p className="text-sm text-slate-400">{item.title}</p>
            <h3 className="mt-3 text-3xl font-bold">
              {loading ? "..." : item.value}
            </h3>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-6 text-xl font-semibold">Recent Emails</h3>

        {loading ? (
          <p className="py-12 text-center text-slate-400">
            Loading emails...
          </p>
        ) : error ? (
          <p className="py-12 text-center text-red-400">{error}</p>
        ) : data.recentEmails.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-lg text-slate-300">No emails yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Your email activity will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-800 text-sm text-slate-400">
                <tr>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Recipients</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEmails.map((email) => (
                  <tr key={email.id} className="border-b border-slate-800">
                    <td className="p-4">{email.subject}</td>
                    <td className="p-4 text-slate-400">
                      {email.recipients
                        .map((recipient) => recipient.address)
                        .join(", ")}
                    </td>
                    <td className="p-4 text-slate-400">
                      {new Date(email.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">{email.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
