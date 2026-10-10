import { useEffect, useState } from "react";
import { apiFetch } from "./api";

function RepairCommunication({ repairId }) {
  const [messages, setMessages] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
        apiFetch(`http://localhost:8080/repairs/${repairId}/messages`),
        apiFetch(`http://localhost:8080/repairs/${repairId}/updates`),
      ])
      .then(async ([messageResponse, updateResponse]) => {
        const [messageData, updateData] = await Promise.all([
          messageResponse.json(),
          updateResponse.json(),
        ]);
        if (!messageResponse.ok || !updateResponse.ok) {
          throw new Error("Unable to load repair conversation");
        }
        if (!active) return;
        setMessages(messageData);
        setUpdates(updateData);
        setMessage("");
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => { active = false; };
  }, [repairId]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      const response = await apiFetch(`http://localhost:8080/repairs/${repairId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to send message");
      setMessages((current) => [...current, data]);
      setDraft("");
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="repair-communication">
      <h4>Repair updates</h4>
      {updates.map((update, index) => (
        <p key={`${update.updatedAt}-${index}`}>
          <strong>{update.note}</strong>{" "}
          <time>{new Date(update.updatedAt).toLocaleString()}</time>
        </p>
      ))}
      <h4>Messages</h4>
      <div className="repair-message-list" aria-live="polite">
        {messages.map((item) => (
          <p key={item.id}>
            <strong>{item.senderName} ({item.senderRole}):</strong> {item.content}{" "}
            <time>{new Date(item.sentAt).toLocaleString()}</time>
          </p>
        ))}
        {messages.length === 0 && <p>No messages yet.</p>}
      </div>
      {message && <p role="alert">{message}</p>}
      <form className="repair-message-form" onSubmit={sendMessage}>
        <input aria-label="Message" maxLength={2000} value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message about this repair" required />
        <button type="submit" disabled={!draft.trim()}>Send</button>
      </form>
    </section>
  );
}

export default RepairCommunication;
