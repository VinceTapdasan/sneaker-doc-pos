import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, inArray, count } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { AuditService } from '../audit/audit.service';
import { branches, transactions } from '../db/schema';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.drizzle.db.select().from(branches).orderBy(branches.name);
  }

  async findActive() {
    return this.drizzle.db
      .select()
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name);
  }

  async findOne(id: number) {
    const [branch] = await this.drizzle.db
      .select()
      .from(branches)
      .where(eq(branches.id, id));
    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }

  async create(dto: CreateBranchDto, performedBy?: string) {
    const [created] = await this.drizzle.db
      .insert(branches)
      .values({
        name: dto.name,
        streetName: dto.streetName ?? null,
        barangay: dto.barangay ?? null,
        city: dto.city ?? null,
        province: dto.province ?? null,
        country: dto.country ?? null,
        phone: dto.phone ?? null,
        createdById: performedBy ?? null,
      })
      .returning();

    await this.audit.log({
      action: `Created branch: ${created.name}`,
      entityType: 'branch',
      entityId: String(created.id),
      source: 'admin',
      performedBy,
      details: { name: created.name, phone: created.phone },
    });

    return created;
  }

  async update(
    id: number,
    dto: Partial<CreateBranchDto> & { isActive?: boolean },
    performedBy?: string,
  ) {
    const existing = await this.findOne(id);

    if (dto.isActive === false) {
      const [{ value }] = await this.drizzle.db
        .select({ value: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.branchId, id),
            inArray(transactions.status, ['pending', 'in_progress']),
          ),
        );

      if (value > 0) {
        throw new BadRequestException(
          `Cannot deactivate branch "${existing.name}" — it has ${value} active transaction${value !== 1 ? 's' : ''} (pending or in progress). Resolve them first.`,
        );
      }
    }
    const [updated] = await this.drizzle.db
      .update(branches)
      .set(dto)
      .where(eq(branches.id, id))
      .returning();

    const isSoftDelete = dto.isActive === false && Object.keys(dto).length === 1;
    await this.audit.log({
      action: isSoftDelete
        ? `Deactivated branch: ${existing.name}`
        : `Updated branch: ${existing.name}`,
      entityType: 'branch',
      entityId: String(id),
      source: 'admin',
      performedBy,
      details: { before: existing, after: updated },
    });

    return updated;
  }
}
