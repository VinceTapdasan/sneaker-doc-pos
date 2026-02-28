'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  loadingRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  hidePagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  loadingRows = 5,
  emptyTitle = 'No data',
  emptyDescription,
  onRowClick,
  pageSize = 20,
  hidePagination = false,
}: DataTableProps<TData, TValue>) {
  const effectivePageSize = hidePagination ? 100_000 : pageSize;
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: effectivePageSize });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const total = data.length;
  const from = total === 0 ? 0 : pageIndex * pagination.pageSize + 1;
  const to = Math.min((pageIndex + 1) * pagination.pageSize, total);
  const showPagination = !isLoading && !hidePagination && total > pagination.pageSize;

  return (
    <div>
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-zinc-100 bg-zinc-50 hover:bg-zinc-50">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-medium text-zinc-400 uppercase tracking-wider h-auto py-3"
                    style={header.column.columnDef.size !== undefined ? { width: header.column.columnDef.size, minWidth: header.column.columnDef.size } : undefined}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <TableRow key={i} className="border-zinc-100">
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="border-zinc-100 hover:bg-white">
                <TableCell colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`border-zinc-100 transition-colors duration-100 ${onRowClick ? 'cursor-pointer hover:bg-zinc-50' : 'hover:bg-zinc-50'}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-zinc-400">
            {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
            >
              <CaretLeftIcon size={14} />
            </button>
            <span className="text-xs text-zinc-500 px-1">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
            >
              <CaretRightIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
