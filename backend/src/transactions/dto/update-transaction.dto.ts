export class UpdateTransactionDto {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status?: string;
  note?: string | null;
  pickupDate?: string;
  newPickupDate?: string | null;
  total?: string;
  paid?: string;
  promoId?: number;
  staffId?: string | null;
}
