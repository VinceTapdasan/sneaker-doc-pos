'use client';

import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { auditColumns } from '@/columns/audit-columns';
import { useAuditQuery } from '@/hooks/useAuditQuery';

export default function AuditPage() {
  const { data: entries = [], isLoading } = useAuditQuery();

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="All system actions" />
      <DataTable
        columns={auditColumns}
        data={entries}
        isLoading={isLoading}
        loadingRows={8}
        emptyTitle="No audit entries"
        emptyDescription="Actions will appear here."
      />
    </div>
  );
}
