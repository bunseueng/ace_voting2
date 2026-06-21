"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

// One printable QR per poster. Each QR opens /poster/<posterId> on the live
// site (origin is read at runtime so it works on whatever domain it's opened).
export default function QrSheet({ eventName, posters }) {
  const [origin, setOrigin] = useState("");
  const [perPage, setPerPage] = useState("1"); // "1" = big one-per-page, "6" = grid

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Controls — hidden when printing */}
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold mr-auto">QR Codes — {eventName}</h1>
        <label className="flex items-center gap-2 text-sm">
          Layout:
          <select
            value={perPage}
            onChange={(e) => setPerPage(e.target.value)}
            className="border px-2 py-1 cursor-pointer"
          >
            <option value="1">One big QR per page</option>
            <option value="6">6 per page (saves paper)</option>
          </select>
        </label>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700"
        >
          Print
        </button>
      </div>

      <p className="print:hidden text-sm text-muted-foreground mb-6">
        {posters.length} posters. Each QR opens its poster&apos;s voting page.
        Print, cut out, and place one beside each poster.
      </p>

      <div
        className={
          perPage === "1"
            ? "space-y-0"
            : "grid grid-cols-2 sm:grid-cols-3 gap-6"
        }
      >
        {posters.map((p) => {
          const url = origin ? `${origin}/poster/${p.posterId}` : "";
          return (
            <div
              key={p.id}
              className={
                perPage === "1"
                  ? "qr-card flex flex-col items-center justify-center text-center py-8"
                  : "qr-card flex flex-col items-center text-center border rounded-lg p-4"
              }
            >
              <p className="font-bold mb-1 text-xl">{eventName}</p>
              <p className="mb-3 text-lg">Poster {p.posterId}</p>
              {url ? (
                <QRCodeCanvas
                  value={url}
                  size={perPage === "1" ? 320 : 150}
                  includeMargin
                  level="M"
                />
              ) : (
                <div className="h-[320px]" />
              )}
              <p className="mt-3 text-xs text-gray-500 break-all max-w-[320px]">
                {url}
              </p>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          .qr-card {
            break-inside: avoid;
          }
          ${perPage === "1"
            ? `.qr-card { page-break-after: always; height: 95vh; }`
            : ``}
        }
      `}</style>
    </div>
  );
}
