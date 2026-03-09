export class CreateTransactionItemDto {
  shoeDescription: string;
  serviceId?: number;
  addonServiceIds?: number[];
  status?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  price?: string; // snapshot of price at intake
}

export class CreateTransactionDto {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerStreetName?: string;
  customerBarangay?: string;
  customerCity?: string;
  customerProvince?: string;
  customerCountry?: string;
  isExistingCustomer?: boolean; // if true, skip customer upsert
  status?: string;
  note?: string;
  pickupDate?: string; // ISO date YYYY-MM-DD
  total?: string;
  paid?: string;
  promoId?: number;
  staffId?: string;
  items?: CreateTransactionItemDto[];
}
