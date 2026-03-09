import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ReportSummary } from '@/lib/types';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  claimed: 'Claimed',
  cancelled: 'Cancelled',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },

  // ── Document header block ──────────────────────────────────────
  headerBlock: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
    height: 85,
  },
  headerLeft: {
    width: 150,
    borderRightWidth: 1,
    borderRightColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 90,
    height: 69,
    objectFit: 'contain',
  },
  headerRight: {
    flex: 1,
    flexDirection: 'column',
  },
  headerRightTitle: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  headerRightTitleText: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  headerMetaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerMetaRowLast: {
    flexDirection: 'row',
  },
  headerMetaLabel: {
    width: 90,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    color: '#333',
  },
  headerMetaValue: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8,
  },

  // ── Section label ─────────────────────────────────────────────
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 14,
    color: '#000',
  },

  // ── Table ─────────────────────────────────────────────────────
  table: { width: '100%' },

  tHead: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingVertical: 5,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#bbb',
    paddingVertical: 6,
  },
  tRowTotal: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: '#000',
    paddingVertical: 6,
    marginTop: 1,
  },
  // Uniform font — no Courier anywhere
  td:     { fontSize: 8.5, color: '#111' },
  tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Column width helpers
  w40:    { width: 40 },
  w50:    { width: 50 },
  w55:    { width: 55 },
  w60:    { width: 60 },
  w70:    { width: 70 },
  w80:    { width: 80 },
  wFlex:  { flex: 1 },
  wFlex2: { flex: 2 },
  wFlex3: { flex: 3 },
  wFlex4: { flex: 4 },
  alignRight: { textAlign: 'right' },

  // Two-column layout
  twoCol: { flexDirection: 'row', gap: 16, marginTop: 2 },
  col:    { flex: 1 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#bbb',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#888' },
});

interface Props {
  data: ReportSummary;
  year: number;
  month: number;
  branchName?: string;
  logoUrl: string;
}

export function ReportPdf({ data, year, month, branchName, logoUrl }: Props) {
  const periodLabel = month === 0 ? `Full Year ${year}` : `${MONTHS[month]} ${year}`;
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

  const headerMeta = [
    { label: 'DATE:', value: generatedAt },
    { label: 'PERIOD:', value: periodLabel },
    { label: 'BRANCH:', value: branchName ?? 'All Branches' },
  ];

  return (
    <Document title={`Report — ${periodLabel}`}>
      <Page size="A4" style={s.page}>

        {/* ── Document header ── */}
        <View style={s.headerBlock}>
          <View style={s.headerLeft}>
            <Image src={logoUrl} style={s.headerLogo} />
          </View>
          <View style={s.headerRight}>
            <View style={s.headerRightTitle}>
              <Text style={s.headerRightTitleText}>SUMMARY REPORT</Text>
            </View>
            {headerMeta.map(({ label, value }, i) => (
              <View key={label} style={i === headerMeta.length - 1 ? s.headerMetaRowLast : s.headerMetaRow}>
                <Text style={s.headerMetaLabel}>{label}</Text>
                <Text style={s.headerMetaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Collections + Status ── */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Collections by Method</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, s.wFlex3]}>Method</Text>
                <Text style={[s.th, s.w80, s.alignRight]}>Amount (PHP)</Text>
              </View>
              {[
                { key: 'cash',         label: 'Cash' },
                { key: 'gcash',        label: 'GCash' },
                { key: 'card',         label: 'Card' },
                { key: 'bank_deposit', label: 'Bank Deposit' },
              ].map(({ key, label }) => (
                <View key={key} style={s.tRow}>
                  <Text style={[s.td, s.wFlex3]}>{label}</Text>
                  <Text style={[s.td, s.w80, s.alignRight]}>
                    {data.collections[key as keyof typeof data.collections]}
                  </Text>
                </View>
              ))}
              <View style={s.tRowTotal}>
                <Text style={[s.tdBold, s.wFlex3]}>Total</Text>
                <Text style={[s.tdBold, s.w80, s.alignRight]}>{data.collections.total}</Text>
              </View>
            </View>
          </View>

          <View style={s.col}>
            <Text style={s.sectionLabel}>Transaction Status</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, s.wFlex3]}>Status</Text>
                <Text style={[s.th, s.w50, s.alignRight]}>Count</Text>
              </View>
              {Object.entries(data.transactions)
                .filter(([k]) => k !== 'total')
                .map(([key, count]) => (
                  <View key={key} style={s.tRow}>
                    <Text style={[s.td, s.wFlex3]}>{STATUS_LABELS[key] ?? key}</Text>
                    <Text style={[s.td, s.w50, s.alignRight]}>{count}</Text>
                  </View>
                ))}
              <View style={s.tRowTotal}>
                <Text style={[s.tdBold, s.wFlex3]}>Total</Text>
                <Text style={[s.tdBold, s.w50, s.alignRight]}>{data.transactions.total}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Top Services ── */}
        {data.topServices.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Top Services</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, s.wFlex4]}>Service Name</Text>
                <Text style={[s.th, s.w60, s.alignRight]}>Bookings</Text>
                <Text style={[s.th, s.w80, s.alignRight]}>Revenue (PHP)</Text>
              </View>
              {data.topServices.map((sv, i) => (
                <View key={i} style={s.tRow}>
                  <Text style={[s.td, s.wFlex4]}>{sv.name}</Text>
                  <Text style={[s.td, s.w60, s.alignRight]}>{sv.count}</Text>
                  <Text style={[s.td, s.w80, s.alignRight]}>{sv.revenue}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Transaction List ── */}
        <Text style={s.sectionLabel}>Transactions ({data.txnList.length})</Text>
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.th, s.w60]}>#</Text>
            <Text style={[s.th, s.wFlex3]}>Customer</Text>
            <Text style={[s.th, s.w50]}>Date</Text>
            <Text style={[s.th, s.w60]}>Status</Text>
            <Text style={[s.th, s.w40, s.alignRight]}>Pairs</Text>
            <Text style={[s.th, s.w60, s.alignRight]}>Total</Text>
            <Text style={[s.th, s.w60, s.alignRight]}>Paid</Text>
          </View>
          {data.txnList.map((t, i) => (
            <View
              key={t.id}
              style={[s.tRow, i === data.txnList.length - 1 ? { borderBottomWidth: 1.5, borderBottomColor: '#000' } : {}]}
            >
              <Text style={[s.td, s.w60]}>{t.number}</Text>
              <Text style={[s.td, s.wFlex3]} numberOfLines={1}>{t.customerName ?? '—'}</Text>
              <Text style={[s.td, s.w50]}>
                {new Date(t.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </Text>
              <Text style={[s.td, s.w60]}>{STATUS_LABELS[t.status] ?? t.status}</Text>
              <Text style={[s.td, s.w40, s.alignRight]}>{t.itemCount}</Text>
              <Text style={[s.td, s.w60, s.alignRight]}>{t.total}</Text>
              <Text style={[s.td, s.w60, s.alignRight]}>{t.paid}</Text>
            </View>
          ))}
        </View>

        {/* ── Expenses ── */}
        {data.expenses.items.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Expenses — Total: {data.expenses.total} PHP</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, s.w70]}>Date</Text>
                <Text style={[s.th, s.wFlex2]}>Category</Text>
                <Text style={[s.th, s.wFlex3]}>Note</Text>
                <Text style={[s.th, s.w70, s.alignRight]}>Amount (PHP)</Text>
              </View>
              {data.expenses.items.map((e) => (
                <View key={e.id} style={s.tRow}>
                  <Text style={[s.td, s.w70]}>{e.dateKey}</Text>
                  <Text style={[s.td, s.wFlex2]}>{e.category ?? '—'}</Text>
                  <Text style={[s.td, s.wFlex3]} numberOfLines={1}>{e.note ?? '—'}</Text>
                  <Text style={[s.td, s.w70, s.alignRight]}>{e.amount}</Text>
                </View>
              ))}
              <View style={s.tRowTotal}>
                <Text style={[s.tdBold, s.w70]}>Total</Text>
                <Text style={[s.wFlex2, s.td]}></Text>
                <Text style={[s.wFlex3, s.td]}></Text>
                <Text style={[s.tdBold, s.w70, s.alignRight]}>{data.expenses.total}</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SneakerDoc POS — Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
