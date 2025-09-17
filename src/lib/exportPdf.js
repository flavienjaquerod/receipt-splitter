import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportReceiptPdf(items, roommates, balances, ticketTotals = {}, receiptName = "Receipt") {
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
    item.assignedTo
      .map(id => roommates.find(r => String(r.id) === String(id))?.name || "Unknown")
      .join(", ")
  ]);

  autoTable(doc, {
    head: [["Item", "Price", "Assigned To"]],
    body: itemRows,
    startY: 45,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] }, // Tailwind blue-500
  });

  // Balances table
  const balanceRows = roommates.map((roommate) => {
    const balance = balances[roommate.id] || { paid: 0, share: 0, owesTo: null };
    const paid = balance.paid || 0;
    const share = balance.share || 0;
    const net = paid - share;

    return [
      roommate.name,
      `CHF ${paid.toFixed(2)}`,
      `CHF ${share.toFixed(2)}`,
      net > 0 ? `+ CHF ${net.toFixed(2)}` : net < 0 ? `- CHF ${Math.abs(net).toFixed(2)}` : "Settled",
    ];
  });

  autoTable(doc, {
    head: [["Roommate", "Paid", "Contribution", "Net"]],
    body: balanceRows,
    startY: doc.lastAutoTable.finalY + 15,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [16, 185, 129] }, // Tailwind green-500
  });

  // Totals section
  const totalsStartY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.text("Totals", 14, totalsStartY);

  const totalCombined = items.reduce((sum, item) => sum + item.currentPrice, 0);
  doc.setFontSize(10);
  doc.text(`Combined receipts: CHF ${totalCombined.toFixed(2)}`, 14, totalsStartY + 8);

  // Object.entries(ticketTotals).forEach(([sourceFile, total], idx) => {
  //   const parsedTotal = parseFloat(total);
  //   const display = isNaN(parsedTotal) ? total : parsedTotal.toFixed(2);
  //   doc.text(`${sourceFile}: CHF ${display}`, 14, totalsStartY + 16 + idx * 8);
  // });

  return doc;
}
