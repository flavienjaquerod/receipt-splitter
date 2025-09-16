import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // ✅ Correct import

export function exportReceiptPdf(items, roommates, balances, receiptName = "Receipt") {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text("Receipt Splitter Summary", 14, 20);

  doc.setFontSize(12);
  doc.text(`Receipt: ${receiptName}`, 14, 28);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 35);

  // Items table
  const itemRows = items.map(item => [
    item.name,
    `CHF ${item.currentPrice.toFixed(2)}`,
    item.assignedTo.map(id => {
      const r = roommates.find(r => r.id === id);
      return r ? r.name : "Unknown";
    }).join(", ")
  ]);

  autoTable(doc, {
    head: [["Item", "Price", "Assigned To"]],
    body: itemRows,
    startY: 45,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] }, // Tailwind blue-500
  });

  // Balances table
  const balanceRows = Object.entries(balances).map(([id, b]) => {
    const roommate = roommates.find(r => r.id === id);
    const paid = b?.paid ?? 0;
    const owes = b?.owes ?? 0;

    return [
      roommate?.name || "Unknown",
      `CHF ${paid.toFixed(2)}`,
      `CHF ${owes.toFixed(2)}`,
      `CHF ${(paid - owes).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    head: [["Roommate", "Paid", "Owes", "Net"]],
    body: balanceRows,
    startY: doc.lastAutoTable.finalY + 15,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [16, 185, 129] }, // Tailwind green-500
  });

  return doc;
}
