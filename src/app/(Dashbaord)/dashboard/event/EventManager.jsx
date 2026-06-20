"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EventManager({ events }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const active = events.find((e) => e.status === "active");

  const open = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Event opened");
      setName("");
      router.refresh();
    } else {
      toast.error("Failed to open event");
    }
  };

  const close = async () => {
    setBusy(true);
    const res = await fetch("/api/event", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Event closed");
      router.refresh();
    } else {
      toast.error("Failed to close event");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Voting Events</h1>

      <form onSubmit={open} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New event name"
          className="border px-3 py-2 flex-1"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-blue-500 text-white px-4 py-2 cursor-pointer disabled:opacity-60"
        >
          New Event
        </button>
      </form>

      {active && (
        <button
          onClick={close}
          disabled={busy}
          className="bg-red-500 text-white px-4 py-2 mb-6 cursor-pointer disabled:opacity-60"
        >
          Close active event ({active.name})
        </button>
      )}

      <ul className="space-y-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="border p-3 flex justify-between items-center"
          >
            <span>{ev.name}</span>
            <span
              className={
                ev.status === "active" ? "text-green-600" : "text-gray-500"
              }
            >
              {ev.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
