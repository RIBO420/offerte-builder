import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#16a34a",
  },
  companyInfo: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  offerteInfo: {
    textAlign: "right",
  },
  offerteNummer: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  offerteType: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 2,
  },
  offerteDate: {
    fontSize: 9,
    color: "#666666",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    color: "#16a34a",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 100,
    fontSize: 9,
    color: "#666666",
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellRight: {
    fontSize: 9,
    textAlign: "right",
  },
  colDescription: {
    flex: 3,
  },
  colScope: {
    flex: 1,
  },
  colQuantity: {
    flex: 1,
    textAlign: "right",
  },
  colPrice: {
    flex: 1,
    textAlign: "right",
  },
  colTotal: {
    flex: 1,
    textAlign: "right",
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#16a34a",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  totalsLabel: {
    width: 150,
    fontSize: 10,
    color: "#666666",
    textAlign: "right",
    paddingRight: 20,
  },
  totalsValue: {
    width: 100,
    fontSize: 10,
    textAlign: "right",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  totalsFinalLabel: {
    width: 150,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 20,
  },
  totalsFinalValue: {
    width: 100,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    color: "#16a34a",
  },
  scopeBadge: {
    backgroundColor: "#f0f9f0",
    color: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#999999",
    fontSize: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  notesSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#666666",
  },
  notesText: {
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  scopeDetails: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  scopeDetailTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  scopeDetailRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  scopeDetailLabel: {
    width: 120,
    fontSize: 9,
    color: "#666666",
  },
  scopeDetailValue: {
    fontSize: 9,
  },
});

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
};
