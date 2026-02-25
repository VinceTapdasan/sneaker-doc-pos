export class CreateTransactionItemDto {
  shoeDescription: string;
  serviceId?: number;
  status?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  price?: string; // snapshot of price at intake
}

export class CreateTransactionDto {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status?: string;
  note?: string;
  pickupDate?: string; // ISO date YYYY-MM-DD
  total?: string;
  paid?: string;
  promoId?: number;
  items?: CreateTransactionItemDto[];
}
