import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { SupabaseService } from '../supabase/supabase.service';
import { DrizzleService } from '../db/drizzle.service';
import { transactionItems, transactions } from '../db/schema';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@Injectable()
export class UploadsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly db: DrizzleService,
    private readonly config: ConfigService,
  ) {}

  async getTransactionBranchId(txnId: number): Promise<number | null> {
    const [txn] = await this.db.db
      .select({ branchId: transactions.branchId })
      .from(transactions)
      .where(eq(transactions.id, txnId))
      .limit(1);
    return txn?.branchId ?? null;
  }

  async createPresignedUrl(dto: PresignedUrlDto) {
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    const ext = dto.extension.toLowerCase().replace(/^\./, '');

    let path: string;

    if (dto.itemId != null) {
      // Legacy: per-item photo
      const [item] = await this.db.db
        .select({ id: transactionItems.id })
        .from(transactionItems)
        .where(eq(transactionItems.id, dto.itemId))
        .limit(1);

      if (!item) throw new NotFoundException('Item not found');
      path = `sneakers/${dto.txnId}/${dto.itemId}/${dto.type}/${Date.now()}.${ext}`;
    } else {
      // Transaction-level photo dump
      path = `txn-photos/${dto.txnId}/${dto.type}/${Date.now()}.${ext}`;
    }

    const { data, error } = await this.supabase.db.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to generate upload URL');
    }

    // Construct the public URL explicitly — getPublicUrl() can produce malformed
    // URLs depending on the storage-js version. This format is guaranteed correct.
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl,
    };
  }
}
