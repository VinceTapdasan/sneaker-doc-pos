export class PresignedUrlDto {
  txnId: number;
  itemId?: number; // optional — omit for transaction-level photo dump
  type: 'before' | 'after';
  extension: string;
}
